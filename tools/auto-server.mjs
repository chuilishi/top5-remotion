#!/usr/bin/env node
import http from "http";
import { readFile, readdir, writeFile, mkdir, stat, unlink } from "fs/promises";
import { existsSync, readFileSync as readFileSyncFs, writeFileSync as writeFileSyncFs, createReadStream } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { appendFileSync } from "fs";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const YAML_PATH = join(ROOT, "content.config.yaml");
const TMP = join(__dirname, ".tmp");
const CACHE_DIR = join(TMP, "cache");
const LOG_DIR = join(TMP, "logs");
const PORT = 3456;

function timeToSec(t) {
  const parts = t.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
}

function secToTime(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${String(m).padStart(2, "0")}:${sec.padStart(4, "0")}`;
}

function videoMime(ext) {
  const map = { webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo", mov: "video/quicktime" };
  return map[ext.toLowerCase()] || "video/mp4";
}

function runCmd(exe, args, cwd, emit) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout?.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      s.split("\n").filter(Boolean).forEach((l) => emit("log", `  ${l.trimEnd()}`));
    });
    child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr }));
    child.on("error", (e) => reject(new Error(`spawn ${exe}: ${e.message}`)));
  });
}

async function downloadVideos(urls, emit) {
  const workDir = join(TMP, `auto_${Date.now()}`);
  await mkdir(workDir, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  const urlMap = {};
  const videoExts = new Set(["mp4", "webm", "mkv", "avi", "mov", "flv", "3gp", "m4v"]);

  // 检查缓存中是否已有该 video ID 的文件
  const cachedFiles = existsSync(CACHE_DIR)
    ? (await readdir(CACHE_DIR)).filter((f) => videoExts.has(extname(f).slice(1).toLowerCase()))
    : [];
  const cachedIds = new Set(cachedFiles.map((f) => basename(f, extname(f))));

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    emit("log", `\n[${i + 1}/${urls.length}] ${url}`);

    // 尝试从 URL 提取 video ID 来检查缓存
    const idMatch = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    const videoId = idMatch ? idMatch[1] : null;

    if (videoId && cachedIds.has(videoId)) {
      // 缓存命中 — 复制到 workDir 而不是重新下载
      const cachedFile = cachedFiles.find((f) => basename(f, extname(f)) === videoId);
      const src = join(CACHE_DIR, cachedFile);
      const dst = join(workDir, cachedFile);
      const { copyFile: cpFile } = await import("fs/promises");
      await cpFile(src, dst);
      urlMap[videoId] = url;
      emit("log", `  ⚡ 缓存命中，跳过下载: ${cachedFile}`);
      continue;
    }

    const tpl = join(workDir, "%(id)s.%(ext)s");
    const args = [
      "-f", "worst", "--no-download-archive", "--newline",
      "--retries", "10", "--fragment-retries", "10", "--extractor-retries", "5",
      "--socket-timeout", "30", "--retry-sleep", "3",
      "--force-ipv4", "--no-check-certificates",
      "-o", tpl, url,
    ];
    emit("log", `  $ yt-dlp ${args.join(" ").slice(0, 120)}...`);
    const { ok, stdout } = await runCmd("yt-dlp", args, workDir, emit);
    if (!ok) { emit("log", "  ✗ 下载失败"); continue; }
    const files = (await readdir(workDir)).filter((f) => videoExts.has(extname(f).slice(1).toLowerCase()));
    let matched = false;
    for (const f of files) {
      const stem = basename(f, extname(f));
      if (!urlMap[stem]) {
        urlMap[stem] = url;
        emit("log", `  ✓ ${f}`);
        matched = true;
        // 缓存新下载的文件
        const { copyFile: cpFile } = await import("fs/promises");
        await cpFile(join(workDir, f), join(CACHE_DIR, f)).catch(() => {});
      }
    }
    if (!matched) emit("log", "  ⚠ 未发现新文件（可能重复URL）");
  }
  return { workDir, urlMap };
}

async function uploadFile(filePath, apiBase, apiKey, emit) {
  const filename = basename(filePath);
  const ext = extname(filename).slice(1) || "mp4";
  const mime = videoMime(ext);
  const data = await readFile(filePath);
  emit("log", `  📤 上传 ${filename} (${(data.length / 1048576).toFixed(1)} MB)...`);

  const form = new FormData();
  form.append("file", new Blob([data], { type: mime }), filename);
  form.append("purpose", "user_data");

  const t0 = Date.now();
  const base = apiBase.replace(/\/+$/, "").replace(/\/v1$/, "");
  const res = await fetch(`${base}/v1/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`上传失败 ${res.status}: ${text.slice(0, 300)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`上传响应非JSON (${res.status}): ${text.slice(0, 200)}`); }
  emit("log", `  ✓ ${json.id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return json.id;
}

async function callLLM(messages, apiBase, apiKey, model, responseFormat, emit) {
  const base = apiBase.replace(/\/+$/, "").replace(/\/v1$/, "");
  const url = `${base}/v1/chat/completions`;
  const body = { model, messages, stream: true, ...(responseFormat ? { response_format: responseFormat } : {}) };
  const bodyStr = JSON.stringify(body);
  emit("log", `  📡 LLM 流式请求 (model=${model}, ${(bodyStr.length / 1048576).toFixed(2)}MB)...`);

  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: bodyStr,
  });
  if (!res.ok) {
    const errText = await res.text();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    throw new Error(`LLM ${res.status} [${secs}s]: ${errText.slice(0, 500)}`);
  }

  let content = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEmit = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          const now = Date.now();
          if (now - lastEmit > 500) {
            emit("log", `  ⏳ 已接收 ${content.length}B...`);
            lastEmit = now;
          }
        }
      } catch {}
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!content) throw new Error(`LLM 流式无内容 [${secs}s]`);
  emit("log", `  ✓ LLM 流式返回 ${content.length}B (${secs}s)`);
  return content;
}

async function geminiAnalyze(workDir, apiBase, apiKey, model, systemPrompt, topic, emit) {
  const videoExts = new Set(["mp4", "webm", "mkv", "avi", "mov", "flv"]);
  const files = (await readdir(workDir)).filter((f) => videoExts.has(extname(f).slice(1).toLowerCase())).sort();
  if (!files.length) throw new Error("工作目录中未找到视频文件");
  emit("log", `找到 ${files.length} 个视频文件`);

  emit("log", `\n📤 并行上传 ${files.length} 个文件...`);
  const fileResults = await Promise.all(
    files.map(async (f, idx) => {
      emit("log", `  [${idx + 1}/${files.length}] ${f}`);
      const fileId = await uploadFile(join(workDir, f), apiBase, apiKey, emit);
      return { filename: f, fileId };
    })
  );

  const userContent = [];
  for (const { filename, fileId } of fileResults) {
    userContent.push({ type: "file", file_id: fileId });
    userContent.push({ type: "text", text: `[文件名: ${filename}]` });
  }
  const userText = topic ? `主题描述:\n${topic}` : "请分析以上视频并提取精彩片段。";
  userContent.push({ type: "text", text: userText });

  const schema = {
    type: "json_schema",
    json_schema: {
      name: "clip_analysis", strict: true,
      schema: {
        type: "object",
        properties: {
          videos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                filename: { type: "string" },
                start_time: { type: "string" },
                end_time: { type: "string" },
              },
              required: ["filename", "start_time", "end_time"],
              additionalProperties: false,
            },
          },
        },
        required: ["videos"],
        additionalProperties: false,
      },
    },
  };

  emit("log", `\n📡 发送分析请求 (${files.length} 个视频)...`);
  const text = await callLLM(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
    apiBase, apiKey, model, schema, emit,
  );
  emit("log", `\n📋 LLM 原始响应 (${text.length}B):\n${text}`);
  return text;
}

async function downloadClips(clipsJson, urlMap, outputDir, padding, emit) {
  await mkdir(outputDir, { recursive: true });
  let jsonStr = clipsJson.trim();
  const m = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (m) jsonStr = m[1].trim();
  emit("log", `\n📋 解析前 JSON 文本 (${jsonStr.length}B):\n${jsonStr}`);
  let parsed;
  try { parsed = JSON.parse(jsonStr); } catch (e) {
    emit("log", `\n❌ JSON 解析失败: ${e.message}\n完整原始文本:\n${jsonStr}`);
    throw e;
  }
  if (!parsed.videos?.length) throw new Error("无有效切片");

  const results = [];
  for (let i = 0; i < parsed.videos.length; i++) {
    const v = parsed.videos[i];
    const stem = basename(v.filename, extname(v.filename));
    const url = urlMap[stem] || urlMap[v.filename];
    if (!url) { emit("log", `  ⚠ 未找到 ${v.filename} (stem=${stem}) 的 URL 映射，跳过`); continue; }

    const origStart = timeToSec(v.start_time);
    const origEnd = timeToSec(v.end_time);
    const padStart = Math.max(0, origStart - padding);
    const padEnd = origEnd + padding;
    const padStartStr = secToTime(padStart);
    const padEndStr = secToTime(padEnd);

    const clipName = `clip_${String(i + 1).padStart(3, "0")}.mp4`;
    const outPath = join(outputDir, clipName);
    const section = `*${padStartStr}-${padEndStr}`;
    emit("log", `\n[${i + 1}/${parsed.videos.length}] ${v.filename} [${v.start_time} → ${v.end_time}] (pad: ${padStartStr}→${padEndStr})`);

    const args = [
      "-f", "bestvideo/best", "--no-download-archive", "--newline",
      "--retries", "10", "--fragment-retries", "10", "--extractor-retries", "5",
      "--socket-timeout", "30", "--retry-sleep", "3",
      "--force-ipv4", "--no-check-certificates",
      "--download-sections", section, "--force-keyframes-at-cuts",
      "--merge-output-format", "mp4", "-o", outPath, url,
    ];
    emit("log", `  $ yt-dlp -f best ... ${url.slice(0, 60)}`);
    const { ok } = await runCmd("yt-dlp", args, outputDir, emit);
    if (!ok || !existsSync(outPath)) { emit("log", "  ⚠ 切片失败，跳过"); continue; }

    const actualPad = origStart - padStart;
    const dur = origEnd - origStart;
    emit("log", `  ✓ → ${clipName} (${dur.toFixed(1)}s, startFrom=${actualPad.toFixed(1)}s)`);
    results.push({ src: clipName, durationSec: Math.round(dur * 10) / 10, startFrom: Math.round(actualPad * 10) / 10, paddedDurationSec: Math.round((padEnd - padStart) * 10) / 10 });
  }
  if (!results.length) throw new Error("所有切片下载失败");
  return results;
}


function updateYamlConfig(rank, folderName, clips) {
  const raw = existsSync(YAML_PATH) ? readFileSyncFs(YAML_PATH, "utf8") : "";
  const config = yaml.load(raw) || {};
  const game = config.games?.find((g) => g.rank === rank);
  if (!game) throw new Error(`YAML 中未找到 rank=${rank} 的游戏`);

  game.clips = clips.map((c, i) => {
    let offset = 0;
    for (let j = 0; j < i; j++) offset += clips[j].durationSec;
    return {
      src: `${folderName}/${c.src}`,
      startFrom: c.startFrom,
      durationSec: c.durationSec,
      offsetSec: Math.round(offset * 10) / 10,
      paddedDurationSec: c.paddedDurationSec,
    };
  });
  const totalDur = clips.reduce((sum, c) => sum + c.durationSec, 0);
  const idx = config.games.indexOf(game);
  if (config.timing?.gameplayDurations) {
    config.timing.gameplayDurations[idx] = Math.round(totalDur);
  }

  writeFileSyncFs(YAML_PATH, yaml.dump(config, { lineWidth: -1, quotingType: '"', forceQuotes: false }), "utf8");
  return totalDur;
}

async function handleAuto(req, res) {
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  });
  await mkdir(LOG_DIR, { recursive: true });
  const logFile = join(LOG_DIR, `auto_${Date.now()}.log`);
  const emit = (type, data) => {
    try { res.write(JSON.stringify({ type, data }) + "\n"); } catch {}
    try { appendFileSync(logFile, `[${new Date().toISOString()}] [${type}] ${typeof data === "string" ? data : JSON.stringify(data)}\n`); } catch {}
  };
  emit("log", `日志文件: ${logFile}`);

  let body = "";
  for await (const chunk of req) body += chunk;
  const { urls, topic, rank, folderName, apiBase, apiKey, model, systemPrompt } = JSON.parse(body);

  try {
    emit("log", "═══ Step 1/4 ─ 低画质下载 ═══");
    const { workDir, urlMap } = await downloadVideos(urls, emit);
    if (!Object.keys(urlMap).length) throw new Error("所有链接下载失败");

    emit("log", "\n═══ Step 2/4 ─ Gemini 分析 ═══");
    const clipsJson = await geminiAnalyze(workDir, apiBase, apiKey, model, systemPrompt, topic, emit);
    emit("json", clipsJson);

    const PADDING = 0.5;
    const outputDir = join(PUBLIC, folderName);
    emit("log", `\n═══ Step 3/4 ─ 高画质切片 → public/${folderName}/ (±${PADDING}s 容差) ═══`);
    const clips = await downloadClips(clipsJson, urlMap, outputDir, PADDING, emit);

    emit("log", `\n═══ Step 4/4 ─ 更新配置 ═══`);
    const totalDur = updateYamlConfig(rank, folderName, clips);
    emit("log", `✓ rank=${rank} 已更新: ${clips.length} 个切片, 总时长 ${totalDur.toFixed(1)}s`);

    emit("done", { clips, totalDur });
  } catch (err) {
    emit("error", err.message);
  }
  res.end();
}

const UI_DIST = join(__dirname, "ui", "dist");

function serveMime(ext) {
  const m = { html: "text/html", js: "application/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", ico: "image/x-icon", json: "application/json", woff2: "font/woff2", woff: "font/woff" };
  return m[ext] || "application/octet-stream";
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && !req.url.startsWith("/api/") && !req.url.startsWith("/public/")) {
    const urlPath = req.url.split("?")[0];
    const filePath = urlPath === "/" || urlPath === "/index.html"
      ? join(UI_DIST, "index.html")
      : join(UI_DIST, urlPath);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath).slice(1).toLowerCase();
      res.writeHead(200, { "Content-Type": `${serveMime(ext)}; charset=utf-8` });
      res.end(data);
      return;
    } catch {
      const html = await readFile(join(UI_DIST, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
  }
  if (req.method === "GET" && req.url === "/api/projects") {
    const projectsDir = join(ROOT, "projects");
    try {
      const dirs = (await readdir(projectsDir, { withFileTypes: true }))
        .filter(d => d.isDirectory())
        .map(d => d.name);
      const projects = [];
      for (const name of dirs) {
        const configPath = join(projectsDir, name, "content.config.yaml");
        projects.push({ name, hasConfig: existsSync(configPath) });
      }
      let current = null;
      const markerPath = join(ROOT, ".current-project");
      if (existsSync(markerPath)) {
        current = readFileSyncFs(markerPath, "utf8").trim();
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ projects, current }));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ projects: [], current: null }));
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/switch-project") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { name } = JSON.parse(body);
      const configSrc = join(ROOT, "projects", name, "content.config.yaml");
      if (!existsSync(configSrc)) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `projects/${name}/content.config.yaml not found` }));
        return;
      }
      const data = await readFile(configSrc, "utf8");
      writeFileSyncFs(YAML_PATH, data, "utf8");
      writeFileSyncFs(join(ROOT, ".current-project"), name, "utf8");
      const { execSync } = await import("child_process");
      execSync("npm run config", { cwd: ROOT, stdio: "ignore" });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, name }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/save-project") {
    try {
      const markerPath = join(ROOT, ".current-project");
      if (!existsSync(markerPath)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "No active project" }));
        return;
      }
      const name = readFileSyncFs(markerPath, "utf8").trim();
      const configDest = join(ROOT, "projects", name, "content.config.yaml");
      const data = await readFile(YAML_PATH, "utf8");
      await mkdir(join(ROOT, "projects", name), { recursive: true });
      writeFileSyncFs(configDest, data, "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, name }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (req.method === "GET" && req.url === "/api/config") {
    try {
      const raw = await readFile(YAML_PATH, "utf8");
      const config = yaml.load(raw);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(config.games || []));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/game-name") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { rank, titleEn, titleZh } = JSON.parse(body);
      const raw = existsSync(YAML_PATH) ? readFileSyncFs(YAML_PATH, "utf8") : "";
      const config = yaml.load(raw) || {};
      const game = config.games?.find((g) => g.rank === rank);
      if (game) {
        game.titleEn = titleEn;
        game.titleZh = titleZh;
        writeFileSyncFs(YAML_PATH, yaml.dump(config, { lineWidth: -1, quotingType: '"', forceQuotes: false }), "utf8");
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    } catch {
      res.writeHead(400);
      res.end("Bad Request");
    }
    return;
  }
  if (req.method === "GET" && req.url.startsWith("/public/")) {
    const filePath = join(ROOT, decodeURIComponent(req.url));
    try {
      const fileStat = await stat(filePath);
      const total = fileStat.size;
      const ext = extname(filePath).slice(1).toLowerCase();
      const mimeMap = { mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", jpg: "image/jpeg", png: "image/png" };
      const mime = mimeMap[ext] || "application/octet-stream";
      const range = req.headers.range;
      if (range) {
        const match = range.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : total - 1;
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": mime,
          });
          createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(416, { "Content-Range": `bytes */${total}` });
          res.end();
        }
      } else {
        res.writeHead(200, {
          "Content-Length": total,
          "Content-Type": mime,
          "Accept-Ranges": "bytes",
        });
        createReadStream(filePath).pipe(res);
      }
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
    return;
  }
  if (req.method === "GET" && req.url.startsWith("/api/game-detail")) {
    try {
      const rank = parseInt(req.url.split("rank=")[1]);
      const raw = await readFile(YAML_PATH, "utf8");
      const config = yaml.load(raw);
      const game = config.games?.find((g) => g.rank === rank);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(game || null));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("null");
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/save-timing") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { rank, subtitles, stats, clips } = JSON.parse(body);
      const raw = existsSync(YAML_PATH) ? readFileSyncFs(YAML_PATH, "utf8") : "";
      const config = yaml.load(raw) || {};
      const game = config.games?.find((g) => g.rank === rank);
      if (game) {
        if (subtitles) game.subtitles = subtitles;
        if (stats) game.stats = stats;
        if (clips) {
          game.clips = clips;
          const totalDur = Math.max(...clips.map(c => (c.offsetSec || 0) + c.durationSec));
          const idx = config.games.indexOf(game);
          if (config.timing?.gameplayDurations) {
            config.timing.gameplayDurations[idx] = Math.round(totalDur);
          }
        }
        writeFileSyncFs(YAML_PATH, yaml.dump(config, { lineWidth: -1, quotingType: '"', forceQuotes: false }), "utf8");
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    } catch {
      res.writeHead(400);
      res.end("Bad Request");
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/auto") {
    return handleAuto(req, res);
  }
  res.writeHead(404);
  res.end("Not Found");
});

await mkdir(TMP, { recursive: true });
server.listen(PORT, () => {
  console.log(`\n  🎬 Auto Clips API: http://localhost:${PORT}\n`);
});
