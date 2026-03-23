#!/usr/bin/env node
import http from "http";
import { readFile, readdir, stat } from "fs/promises";
import { existsSync, readFileSync as readFileSyncFs, writeFileSync as writeFileSyncFs, createReadStream, readdirSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CURRENT_PROJECT_PATH = join(ROOT, ".current-project");

const PORT = 3456;

function loadFullConfig() {
  if (!existsSync(CURRENT_PROJECT_PATH)) return {};
  const project = readFileSyncFs(CURRENT_PROJECT_PATH, "utf8").trim();
  const projectDir = join(ROOT, "projects", project);
  const projectYaml = join(projectDir, "project.yaml");
  const config = existsSync(projectYaml) ? yaml.load(readFileSyncFs(projectYaml, "utf8")) || {} : {};
  if (existsSync(projectDir)) {
    const rankFiles = readdirSync(projectDir).filter(f => /^rank_\d+_.+\.yaml$/.test(f)).sort();
    if (rankFiles.length > 0) {
      const games = rankFiles.map(f => yaml.load(readFileSyncFs(join(projectDir, f), "utf8")));
      games.sort((a, b) => b.rank - a.rank);
      config.games = games;
    }
  }
  return config;
}

function getProjectDir() {
  if (!existsSync(CURRENT_PROJECT_PATH)) return null;
  const name = readFileSyncFs(CURRENT_PROJECT_PATH, "utf8").trim();
  return join(ROOT, "projects", name);
}

function findRankFilePath(rank) {
  const dir = getProjectDir();
  if (!dir || !existsSync(dir)) return null;
  const files = readdirSync(dir).filter(f => /^rank_\d+_.+\.yaml$/.test(f));
  for (const f of files) {
    const d = yaml.load(readFileSyncFs(join(dir, f), "utf8"));
    if (d.rank === rank) return join(dir, f);
  }
  return null;
}

function saveRankData(rank, data) {
  const filePath = findRankFilePath(rank);
  if (!filePath) throw new Error(`Rank file not found for rank ${rank}`);
  writeFileSyncFs(filePath, yaml.dump(data, { lineWidth: -1, quotingType: '"', forceQuotes: false }), "utf8");
}

function saveHeaderTiming(config) {
  const dir = getProjectDir();
  if (!dir) return;
  const yamlPath = join(dir, "project.yaml");
  const raw = existsSync(yamlPath) ? readFileSyncFs(yamlPath, "utf8") : "";
  const header = yaml.load(raw) || {};
  if (config.timing) header.timing = config.timing;
  writeFileSyncFs(yamlPath, yaml.dump(header, { lineWidth: -1, quotingType: '"', forceQuotes: false }), "utf8");
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
        const configPath = join(projectsDir, name, "project.yaml");
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
      const configSrc = join(ROOT, "projects", name, "project.yaml");
      if (!existsSync(configSrc)) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `projects/${name}/project.yaml not found` }));
        return;
      }
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
  if (req.method === "GET" && req.url === "/api/config") {
    try {
      const config = loadFullConfig();
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
      const config = loadFullConfig();
      const game = config.games?.find((g) => g.rank === rank);
      if (game) {
        game.titleEn = titleEn;
        game.titleZh = titleZh;
        saveRankData(rank, game);
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
      const config = loadFullConfig();
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
      const { rank, subtitles, stats, clips, voiceover } = JSON.parse(body);
      const config = loadFullConfig();
      const game = config.games?.find((g) => g.rank === rank);
      if (game) {
        if (subtitles) game.subtitles = subtitles;
        if (stats) game.stats = stats;
        if (voiceover) game.voiceover = voiceover;
        if (clips) {
          game.clips = clips;
          let cum = 0, maxEnd = 0;
          for (const c of clips) {
            const start = c.offsetSec != null ? c.offsetSec : cum;
            const end = start + c.durationSec;
            if (end > maxEnd) maxEnd = end;
            cum += c.durationSec;
          }
          const idx = config.games.indexOf(game);
          if (config.timing?.gameplayDurations) {
            config.timing.gameplayDurations[idx] = Math.round(maxEnd);
            saveHeaderTiming(config);
          }
        }
        saveRankData(rank, game);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    } catch {
      res.writeHead(400);
      res.end("Bad Request");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n  🎬 Clips Editor API: http://localhost:${PORT}\n`);
});
