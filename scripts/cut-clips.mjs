/**
 * cut-clips.mjs — Gemini 选片结果 → 高画质分段清单 / 切片文件 + rank YAML clips
 *
 * 与 fill-timeline.mjs 同一原则：LLM 只做判断（选哪几个镜头），
 * 所有机械换算（下载区间、padding、startFrom、offsetSec、帧对齐）由脚本完成。
 *
 * 用法：
 *   node scripts/cut-clips.mjs <rank-yaml> <clips-json> --sections
 *     → 打印需要下载的高画质分段，原样传给 ytdlp_download / bili_download
 *   node scripts/cut-clips.mjs <rank-yaml> <clips-json> [--target <sec>]   (--target 时按 60fps 对齐)
 *     → 切片到 public/{project}/{folder}/clip_NNN.mp4，并写入 rank YAML 的 clips
 *
 * <clips-json> 可以直接是 Gemini 的原始回复（含 ```json 代码块和解释文字），
 * 只要其中有 { "clips": [{ filename, url, start_time, end_time }] }。
 *
 * 目标时长默认取 public/_active/project.json 的 timing.gameplayDurations，
 * 因此必须先 `npm run project -- <name>` 切到该项目。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import yaml from 'js-yaml';

const HQ_DIR = 'temp_analysis/hq';
const PAD_SEC = 0.5;            // 切片前后各留的容差，YAML 里用 startFrom 跳过前段
const SECTION_MARGIN_SEC = 2;   // 分段下载时在镜头两侧多留的余量
const SECTION_MERGE_GAP_SEC = 8; // 同源镜头间隔小于此值时合并成一个分段
const MAX_EXTEND_SEC = 0.3;     // 凑目标时长时单个镜头最多往后延长多少（不超过尾部容差）
const MIN_CLIP_SEC = 0.5;
const MAX_CLIP_SEC = 2.5;
const CONCURRENCY = 4;

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--target');
const [yamlArg, clipsArg] = positional;

if (!yamlArg || !clipsArg) {
  console.error('Usage: node scripts/cut-clips.mjs <rank-yaml> <clips-json> [--sections] [--target <sec>]');
  process.exit(1);
}

const die = (msg) => {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
};
const warnings = [];
const warn = (msg) => warnings.push(msg);

// ── 解析输入 ──────────────────────────────────────────────

const yamlPath = resolve(root, yamlArg);
if (!existsSync(yamlPath)) die(`rank YAML not found: ${yamlArg}`);
const projectMatch = yamlPath.replace(/\\/g, '/').match(/\/projects\/([^/]+)\/rank_\d+_[^/]+\.yaml$/);
if (!projectMatch) die(`rank YAML must be projects/<project>/rank_<N>_<name>.yaml, got ${yamlArg}`);
const project = projectMatch[1];
const rankDoc = yaml.load(readFileSync(yamlPath, 'utf8'));

const voSrc = rankDoc.voiceover?.[0]?.src;
const folder = voSrc?.split('/')[1]
  || String(rankDoc.titleEn || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
if (!folder) die('cannot determine folder (no voiceover src and no titleEn)');

function parseClipsJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed?.clips)) return parsed.clips;
      if (Array.isArray(parsed)) return parsed;
    } catch { /* try next */ }
  }
  die(`no { "clips": [...] } JSON found in ${clipsArg}`);
}

function parseTime(t) {
  if (typeof t === 'number') return t;
  const parts = String(t).trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) die(`bad timestamp: ${t}`);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function sourceOf(clip) {
  const url = clip.url || '';
  const bv = (url + ' ' + (clip.filename || '')).match(/BV[0-9A-Za-z]{10}/);
  if (bv) return { platform: 'bili', id: bv[0], url: url || `https://www.bilibili.com/video/${bv[0]}/` };
  const yt = url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([0-9A-Za-z_-]{11})/);
  const id = yt?.[1] || basename(clip.filename || '', extname(clip.filename || '')).replace(/^hq_/, '');
  if (!id) die(`cannot identify source video for clip ${JSON.stringify(clip)}`);
  return { platform: 'youtube', id, url: url || `https://www.youtube.com/watch?v=${id}` };
}

const rawClips = parseClipsJson(readFileSync(resolve(root, clipsArg), 'utf8'));
if (rawClips.length === 0) die('clips list is empty');
const clips = rawClips.map((c, i) => {
  const start = parseTime(c.start_time ?? c.start);
  const end = parseTime(c.end_time ?? c.end);
  if (!(end > start)) die(`clip ${i + 1}: end (${end}) must be after start (${start})`);
  return { ...sourceOf(c), start, end };
});

// ── --sections：只打印需要下载的分段 ─────────────────────

const hqPath = resolve(root, HQ_DIR);
const hqFiles = existsSync(hqPath) ? readdirSync(hqPath) : [];

function sectionFiles(id) {
  return hqFiles
    .map((f) => {
      const m = f.match(/^(.+)@([\d.]+)-([\d.]+)\.mp4$/);
      return m && m[1] === id ? { file: f, start: Number(m[2]), end: Number(m[3]) } : null;
    })
    .filter(Boolean);
}

function fullFile(id) {
  return [`${id}.mp4`, `hq_${id}.mp4`].find((f) => hqFiles.includes(f));
}

/** 找一个覆盖 [from, to] 的高画质文件，返回 { file, offset } */
function locate(src, from, to) {
  const full = fullFile(src.id);
  if (full) return { file: full, offset: 0 };
  const sec = sectionFiles(src.id).find((s) => s.start <= from + 1e-6 && s.end >= to - 1e-6);
  return sec ? { file: sec.file, offset: sec.start } : null;
}

if (flag('--sections')) {
  const sections = [];
  const bili = new Set();
  const byId = new Map();
  for (const c of clips) {
    if (!byId.has(c.id)) byId.set(c.id, { src: c, clips: [] });
    byId.get(c.id).clips.push(c);
  }
  for (const { src, clips: group } of byId.values()) {
    if (src.platform === 'bili') {
      if (!fullFile(src.id)) bili.add(src.url);
      continue;
    }
    const sorted = [...group].sort((a, b) => a.start - b.start);
    const spans = [];
    for (const c of sorted) {
      const last = spans[spans.length - 1];
      if (last && c.start - last.end < SECTION_MERGE_GAP_SEC) last.end = Math.max(last.end, c.end);
      else spans.push({ start: c.start, end: c.end });
    }
    for (const s of spans) {
      const start = Math.max(0, Math.floor((s.start - SECTION_MARGIN_SEC) * 10) / 10);
      const end = Math.ceil((s.end + SECTION_MARGIN_SEC) * 10) / 10;
      if (!locate(src, start, end)) sections.push({ url: src.url, start, end });
    }
  }
  const plan = {};
  if (sections.length) plan.ytdlp_download = { sections, output_dir: HQ_DIR, quality: 'hq' };
  if (bili.size) plan.bili_download = { urls: [...bili], output_dir: HQ_DIR, quality: 'hq' };
  console.log(JSON.stringify(plan, null, 2));
  if (!sections.length && !bili.size) console.error('All sources already downloaded — run without --sections to cut.');
  process.exit(0);
}

// ── 目标时长 ─────────────────────────────────────────────

function readTarget() {
  if (option('--target')) return { target: Number(option('--target')), fps: 60 };
  const current = existsSync(resolve(root, '.current-project'))
    ? readFileSync(resolve(root, '.current-project'), 'utf8').trim()
    : '';
  if (current !== project) die(`active project is "${current}", not "${project}" — run: npm run project -- ${project}`);
  const proj = JSON.parse(readFileSync(resolve(root, 'public/_active/project.json'), 'utf8'));
  const durations = proj.timing?.gameplayDurations;
  if (!Array.isArray(durations)) die('public/_active/project.json has no timing.gameplayDurations — run npm run config');
  // 与 build-config.mjs 保持一致：按 rank 降序（#5 在前）
  const ranks = readdirSync(resolve(root, 'projects', project))
    .filter((f) => /^rank_\d+_.+\.yaml$/.test(f))
    .map((f) => yaml.load(readFileSync(resolve(root, 'projects', project, f), 'utf8')).rank)
    .sort((a, b) => b - a);
  const idx = ranks.indexOf(rankDoc.rank);
  if (idx < 0 || durations[idx] == null) die(`no gameplay duration for rank ${rankDoc.rank}`);
  return { target: durations[idx], fps: proj.fps || 60 };
}

const { target, fps: FPS } = readTarget();

// ── 凑目标时长 + 帧对齐 ──────────────────────────────────

const durs = clips.map((c) => Math.min(c.end - c.start, MAX_CLIP_SEC));
const sum = () => durs.reduce((a, b) => a + b, 0);

for (let pass = 0; pass < 10 && Math.abs(target - sum()) > 0.01; pass++) {
  const diff = target - sum();
  if (diff > 0) {
    const room = durs.map((d, i) => Math.max(0, Math.min(MAX_CLIP_SEC - d, clips[i].end - clips[i].start + MAX_EXTEND_SEC - d)));
    const open = room.filter((r) => r > 1e-6).length;
    if (!open) break;
    const share = diff / open;
    durs.forEach((d, i) => { if (room[i] > 1e-6) durs[i] = d + Math.min(share, room[i]); });
  } else {
    const room = durs.map((d) => Math.max(0, d - MIN_CLIP_SEC));
    const totalRoom = room.reduce((a, b) => a + b, 0);
    if (totalRoom < 1e-6) break;
    const ratio = Math.min(1, -diff / totalRoom);
    durs.forEach((d, i) => { durs[i] = d - room[i] * ratio; });
  }
}

const frames = durs.map((d) => Math.max(1, Math.round(d * FPS)));
const totalSec = frames.reduce((a, b) => a + b, 0) / FPS;
const gap = target - totalSec;
if (gap > 0.5) warn(`clips total ${totalSec.toFixed(2)}s is ${gap.toFixed(2)}s short of target ${target.toFixed(2)}s — 画面会循环补齐，最好再补一个镜头`);
if (gap < -0.5) warn(`clips total ${totalSec.toFixed(2)}s exceeds target ${target.toFixed(2)}s by ${(-gap).toFixed(2)}s — 超出部分会被截掉`);

// ── 质量检查（只警告，不阻断）─────────────────────────────

if (clips.length < 7 || clips.length > 12) warn(`${clips.length} clips (expected 7-12)`);
clips.forEach((c, i) => {
  const d = c.end - c.start;
  if (d < MIN_CLIP_SEC || d > MAX_CLIP_SEC) warn(`clip ${i + 1}: ${d.toFixed(2)}s outside ${MIN_CLIP_SEC}-${MAX_CLIP_SEC}s`);
  const prev = clips[i - 1];
  if (prev && prev.id === c.id && c.start - prev.end < 1.0) warn(`clip ${i + 1}: only ${(c.start - prev.end).toFixed(2)}s after clip ${i} in the same source (expected ≥ 1.0s)`);
});
const seen = new Set();
clips.forEach((c, i) => {
  if (i > 0 && clips[i - 1].id !== c.id && seen.has(c.id)) warn(`clip ${i + 1}: source ${c.id} reappears after switching away (A→B→A)`);
  seen.add(c.id);
});

// ── 定位高画质源文件 ──────────────────────────────────────

const plan = clips.map((c, i) => {
  const dur = frames[i] / FPS;
  const from = Math.max(0, c.start - PAD_SEC);
  const to = c.start + dur + PAD_SEC;
  const loc = locate(c, from, to);
  if (!loc) die(`clip ${i + 1}: no HQ file in ${HQ_DIR}/ covers ${c.id} ${from.toFixed(1)}-${to.toFixed(1)}s — run with --sections and download first`);
  const localStart = c.start - loc.offset;
  const padStart = Math.max(0, localStart - PAD_SEC);
  const startFrom = localStart - padStart;
  return {
    input: `${HQ_DIR}/${loc.file}`,
    padStart,
    padDur: startFrom + dur + PAD_SEC,
    startFrom,
    dur,
    out: `${project}/${folder}/clip_${String(i + 1).padStart(3, '0')}.mp4`,
  };
});

// ── 切片 ─────────────────────────────────────────────────

function findFfmpeg() {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0) return 'ffmpeg';
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const bundled = resolve(repoRoot, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
  if (existsSync(bundled)) return bundled;
  die('ffmpeg not found on PATH or in node_modules/@remotion/compositor-win32-x64-msvc/');
}

function runFfmpeg(bin, p) {
  const ffArgs = [
    '-y', '-v', 'error',
    '-ss', p.padStart.toFixed(3), '-i', p.input, '-t', p.padDur.toFixed(3),
    // 必须重编码：-c copy 会产生负 PTS 和混杂编码（av1/vp9/h264），compositor 取帧会出错
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    resolve(root, 'public', p.out),
  ];
  return new Promise((res, rej) => {
    const proc = spawn(bin, ffArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => (code === 0 ? res() : rej(new Error(`${p.out}: ffmpeg exited ${code}\n${stderr.slice(0, 800)}`))));
    proc.on('error', rej);
  });
}

const ffmpeg = findFfmpeg();
const outDir = resolve(root, 'public', project, folder);
mkdirSync(outDir, { recursive: true });
// 重跑时镜头数可能变少，先清掉旧切片，避免残留文件被误用
for (const f of readdirSync(outDir)) {
  if (/^clip_\d+\.mp4$/.test(f)) unlinkSync(resolve(outDir, f));
}

const queue = [...plan];
try {
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await runFfmpeg(ffmpeg, queue.shift());
  }));
} catch (err) {
  die(err.message);
}

// ── 写回 rank YAML ───────────────────────────────────────

let offsetFrames = 0;
const round = (n) => Math.round(n * 1000) / 1000;
rankDoc.clips = plan.map((p, i) => {
  const entry = {
    src: p.out,
    startFrom: round(p.startFrom),
    durationSec: round(frames[i] / FPS),
    offsetSec: round(offsetFrames / FPS),
    paddedDurationSec: round(p.padDur),
  };
  offsetFrames += frames[i];
  return entry;
});
writeFileSync(yamlPath, yaml.dump(rankDoc, { lineWidth: -1, quotingType: '"', forceQuotes: false }));

console.log(`${yamlArg}: ${plan.length} clips, ${totalSec.toFixed(2)}s (target ${target.toFixed(2)}s)`);
for (const w of warnings) console.warn(`Warning: ${w}`);
