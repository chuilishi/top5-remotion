import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';

const TITLE_DELAY_SEC = 0.4;
const BRAND_SEGMENT_GAP_SEC = 0.3;
const BRAND_TO_MAIN_GAP_SEC = 0.8;
const SENTENCE_GAP_SEC = 0.3;

const root = resolve(process.cwd());
const currentProjectFile = resolve(root, '.current-project');
const projectName = process.argv[2]
  || (existsSync(currentProjectFile) ? readFileSync(currentProjectFile, 'utf8').trim() : '');

if (!projectName) {
  console.error('Usage: node scripts/fill-timeline.mjs <project-name>');
  console.error('Or set .current-project first.');
  process.exit(1);
}

const projectDir = resolve(root, 'projects', projectName);
if (!existsSync(projectDir)) {
  console.error(`Project not found: projects/${projectName}`);
  process.exit(1);
}

const ttsOutput = readFileSync(0, 'utf8');
const durations = new Map();
for (const line of ttsOutput.split('\n')) {
  const m = line.match(/\] (.+?) — OK: .+?, ([\d.]+)s/);
  if (m) durations.set(m[1], parseFloat(m[2]));
}

const files = readdirSync(projectDir)
  .filter((f) => f.startsWith('rank_') && f.endsWith('.yaml'))
  .sort()
  .map((f) => resolve(projectDir, f));

for (const f of files) {
  const d = yaml.load(readFileSync(f, 'utf8'));
  const brandVoiceover = Array.isArray(d.brandVoiceover) ? d.brandVoiceover : [];
  const voiceover = Array.isArray(d.voiceover) ? d.voiceover : [];
  const subtitles = Array.isArray(d.subtitles) ? d.subtitles : [];
  const stats = Array.isArray(d.stats) ? d.stats : [];

  let mainStart = TITLE_DELAY_SEC;
  if (brandVoiceover.length) {
    let brandTotal = 0;
    for (const bv of brandVoiceover) {
      const dur = durations.get('public/' + bv.src);
      if (!dur) { console.error('MISSING brand:', bv.src); process.exit(1); }
      bv.durationSec = dur;
      brandTotal += dur;
    }
    brandTotal += BRAND_SEGMENT_GAP_SEC * Math.max(brandVoiceover.length - 1, 0);
    mainStart = TITLE_DELAY_SEC + brandTotal + BRAND_TO_MAIN_GAP_SEC;
  }

  let offset = mainStart;
  for (const vo of voiceover) {
    const dur = durations.get('public/' + vo.src);
    if (!dur) { console.error('MISSING:', vo.src); process.exit(1); }
    vo.offsetSec = offset;
    vo.durationSec = dur;
    offset += dur + SENTENCE_GAP_SEC;
  }

  for (let i = 0; i < subtitles.length; i++) {
    subtitles[i].startSec = voiceover[i]?.offsetSec ?? 0;
    subtitles[i].durationSec = voiceover[i]?.durationSec ?? 0;
  }

  for (const st of stats) {
    if (voiceover.length) {
      const idx = (st.voiceoverIndex || 1) - 1;
      const target = voiceover[Math.min(Math.max(idx, 0), voiceover.length - 1)];
      st.startSec = target.offsetSec;
      st.durationSec = target.durationSec;
    } else {
      st.startSec = 0;
      st.durationSec = 0;
    }
  }

  writeFileSync(f, yaml.dump(d, { lineWidth: -1, quotingType: '"', forceQuotes: false }));
  const total = voiceover.length
    ? voiceover[voiceover.length - 1].offsetSec + voiceover[voiceover.length - 1].durationSec
    : 0;
  console.log(`${f}: ${voiceover.length} entries, ${total.toFixed(1)}s total`);
}
