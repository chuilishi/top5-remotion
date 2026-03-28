#!/usr/bin/env node
import http from "http";
import { readFile, readdir, stat } from "fs/promises";
import { existsSync, readFileSync as readFileSyncFs, writeFileSync as writeFileSyncFs, createReadStream, readdirSync, statSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { execSync, spawn } from "child_process";
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

  // ── Upload APIs ──
  if (req.method === "GET" && req.url === "/api/upload/videos") {
    const outDir = join(ROOT, "out");
    try {
      const files = existsSync(outDir)
        ? readdirSync(outDir).filter(f => /\.mp4$/i.test(f)).map(f => {
            const s = statSync(join(outDir, f));
            return { name: f, sizeMB: +(s.size / 1048576).toFixed(1), mtime: s.mtime.toISOString() };
          }).sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
        : [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(files));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/upload/info") {
    try {
      const config = loadFullConfig();
      let titleSuggestion = "";
      if (config.titleLine1 || config.titleLine2) {
        titleSuggestion = (config.titleLine1 || "") + (config.titleLine2 || "");
      }
      const episodeFile = join(ROOT, ".episode");
      const lastEp = existsSync(episodeFile) ? parseInt(readFileSyncFs(episodeFile, "utf8").trim()) || 0 : 0;
      const current = existsSync(join(ROOT, ".current-project")) ? readFileSyncFs(join(ROOT, ".current-project"), "utf8").trim() : null;
      const partitions = [
        { tid: 237, name: "运动文化" },
        { tid: 238, name: "运动综合" },
        { tid: 17,  name: "单机游戏" },
        { tid: 95,  name: "数码" },
        { tid: 183, name: "影视剪辑" },
        { tid: 201, name: "科学科普" },
        { tid: 86,  name: "特摄" },
        { tid: 65,  name: "网络游戏" },
      ];
      const tagParts = [];
      if (config.titleLine1) tagParts.push(config.titleLine1);
      if (config.titleLine2) tagParts.push(config.titleLine2);
      tagParts.push("TOP5", "排行榜", "盘点");
      if (config.games) {
        for (const g of config.games) {
          if (g.titleZh && !tagParts.includes(g.titleZh)) tagParts.push(g.titleZh);
        }
      }
      const tagSuggestion = tagParts.join(",");
      const accounts = readdirSync(ROOT).filter(f => /^cookies.*\.json$/i.test(f)).map(f => f.replace(/\.json$/, ''));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ titleSuggestion, tagSuggestion, lastEpisode: lastEp, currentProject: current, partitions, accounts }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/upload/tag-recommend")) {
    const url = new URL(req.url, "http://localhost");
    const title = url.searchParams.get("title") || "";
    const account = url.searchParams.get("account") || "cookies";
    const cookieFile = join(ROOT, account + ".json");
    try {
      if (!existsSync(cookieFile)) throw new Error("Cookie file not found");
      const cookieData = JSON.parse(readFileSyncFs(cookieFile, "utf8"));
      const sessdata = cookieData?.cookie_info?.cookies?.find(c => c.name === "SESSDATA")?.value;
      if (!sessdata) throw new Error("SESSDATA not found in cookies");
      const apiUrl = `https://member.bilibili.com/x/vupre/web/tag/recommend?upload_id=&subtype_id=&title=${encodeURIComponent(title)}&filename=&description=&cover_url=`;
      const resp = await fetch(apiUrl, {
        headers: {
          "Cookie": `SESSDATA=${sessdata}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://member.bilibili.com/platform/upload/video/frame",
        },
      });
      const data = await resp.json();
      const tags = (data.data || []).map(t => t.tag);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tags }));
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tags: [], error: e.message }));
    }
    return;
  }

  // ── Danmaku API ──
  if (req.method === "GET" && req.url?.startsWith("/api/danmaku/timing")) {
    const qs = new URL(req.url, "http://localhost").searchParams;
    const projectName = qs.get("project");
    if (!projectName) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing project" }));
      return;
    }
    const projectYaml = join(ROOT, "projects", projectName, "project.yaml");
    if (!existsSync(projectYaml)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "project not found" }));
      return;
    }
    const cfg = yaml.load(readFileSyncFs(projectYaml, "utf8")) || {};
    const t = cfg.timing || {};
    const intro = t.introDuration || 0;
    const trans = t.rankTransitionDurations || [];
    const gameplay = t.gameplayDurations || [];
    const gameplayStarts = [];
    let cur = intro;
    for (let i = 0; i < trans.length; i++) {
      cur += trans[i];
      gameplayStarts.push(cur);
      cur += (gameplay[i] || 0);
    }
    const rankFiles = readdirSync(join(ROOT, "projects", projectName))
      .filter(f => /^rank_\d+_.+\.yaml$/.test(f)).sort();
    const names = rankFiles.map(f => {
      const rk = yaml.load(readFileSyncFs(join(ROOT, "projects", projectName, f), "utf8"));
      return rk?.name || f.replace(/^rank_\d+_/, '').replace(/\.yaml$/, '');
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ gameplayStarts, names, timing: t }));
    return;
  }

  if (req.method === "GET" && req.url === "/api/danmaku/cookie") {
    const file = join(ROOT, "danmaku_cookie.json");
    try {
      const raw = existsSync(file) ? JSON.parse(readFileSyncFs(file, "utf8")) : [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cookies: raw }));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cookies: [] }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/danmaku/cookie") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { cookies } = JSON.parse(body);
      writeFileSyncFs(join(ROOT, "danmaku_cookie.json"), JSON.stringify(cookies, null, 2), "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/danmaku/send") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { bvid, sessdata, bili_jct, items } = JSON.parse(body);
      if (!sessdata || !bili_jct) throw new Error("缺少 Cookie 凭证");
      if (!bvid) throw new Error("缺少 BV 号");
      if (!items?.length) throw new Error("弹幕列表为空");

      const bv = bvid.startsWith("BV") ? bvid : `BV${bvid}`;
      const infoRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`, {
        headers: { Cookie: `SESSDATA=${sessdata}`, "User-Agent": "Mozilla/5.0" },
      });
      const infoJson = await infoRes.json();
      if (infoJson.code !== 0) throw new Error(`获取视频信息失败: ${infoJson.message}`);
      const oid = infoJson.data.cid;

      const results = [];
      for (let i = 0; i < items.length; i++) {
        const { time, msg, color = 16777215, mode = 1 } = items[i];
        const params = new URLSearchParams({
          type: "1", oid: String(oid), msg, progress: String(Math.round(time * 1000)),
          color: String(color), fontsize: "25", pool: "0", mode: String(mode),
          rnd: String(Date.now() * 1000), csrf: bili_jct,
        });
        const dmRes = await fetch("https://api.bilibili.com/x/v2/dm/post", {
          method: "POST",
          headers: {
            Cookie: `SESSDATA=${sessdata}; bili_jct=${bili_jct}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Referer: `https://www.bilibili.com/video/${bv}`,
          },
          body: params.toString(),
        });
        const dmJson = await dmRes.json();
        const ok = dmJson.code === 0;
        results.push({ idx: i, ok, msg: `${ok ? "✓" : "✗"} ${time}s "${msg}" ${ok ? "" : dmJson.message || ""}`.trim() });
        if (i < items.length - 1) await new Promise(r => setTimeout(r, 8000 + Math.random() * 4000));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message, results: [{ idx: 0, ok: false, msg: e.message }] }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/upload/submit") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { video, title, tid, dtime, episode, account, tags } = JSON.parse(body);
      const videoPath = join(ROOT, "out", video);
      if (!existsSync(videoPath)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: `视频不存在: ${video}` }));
        return;
      }
      const cookieFile = join(ROOT, (account || "cookies") + ".json");
      if (!existsSync(cookieFile)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "未找到 cookies.json，请先通过 biliup login 登录" }));
        return;
      }

      const coverPng = join(ROOT, "out", video.replace(/\.mp4$/i, "_cover.png"));
      const coverPath = existsSync(coverPng) ? coverPng : join(ROOT, "out", ".upload_cover.jpg");
      if (!existsSync(coverPng)) {
        try {
          execSync(`ffmpeg -y -ss 1 -i "${videoPath}" -frames:v 1 -q:v 2 "${coverPath}"`, { stdio: "ignore" });
        } catch {}
      }

      const args = [
        "-u", cookieFile,
        "upload", videoPath,
        "--title", title,
        "--tid", String(tid),
        "--copyright", "1",
        "--desc", "-",
        "--no-reprint", "0",
      ];
      if (dtime) args.push("--dtime", String(dtime));
      if (tags) args.push("--tag", tags);
      if (existsSync(coverPath)) args.push("--cover", coverPath);

      const child = spawn("biliup", args, { cwd: ROOT, shell: false });
      let stdout = "", stderr = "";
      child.stdout.on("data", d => stdout += d);
      child.stderr.on("data", d => stderr += d);
      child.on("close", code => {
        if (code === 0) {
          if (episode) {
            writeFileSyncFs(join(ROOT, ".episode"), String(episode), "utf8");
          }
          const allOutput = stdout + stderr;
          const bvMatch = allOutput.match(/"bvid":\s*(?:String\(")?(BV[\w]+)/);
          const bvid = bvMatch ? bvMatch[1] : "";
          const msg = bvid ? `投稿成功！${bvid}` : "投稿成功";
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, message: msg }));
        } else {
          const errMsg = (stderr || stdout || "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: errMsg || `biliup exit code ${code}` }));
        }
      });
      child.on("error", e => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      });
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n  🎬 Clips Editor API: http://localhost:${PORT}\n`);
});

process.on("SIGINT", () => { server.close(); process.exit(); });
