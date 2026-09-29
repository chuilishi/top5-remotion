#!/usr/bin/env node

/**
 * Gemini Media MCP Server (stdio) — video/image/audio analysis via local gemini-go
 *
 * Tools:
 *   analyze_media — Send local media files + prompt to Gemini, return the text reply
 *
 * Backend: gemini-go (Desktop/gemini-go), OpenAI-compatible chat completions.
 * Uses /v1. With no API_KEY in gemini-go's config.json it serves local clients
 * with any key. (The old loopback-only /internal/v1 route was removed from
 * gemini-go; that path now falls through to the WebUI and returns HTML.)
 *
 * Env overrides:
 *   GEMINI_BASE_URL  (default http://127.0.0.1:8787/v1)
 *   GEMINI_API_KEY   (default sk-dummy)
 *
 * Hard limit: total video/audio duration per call <= 30 min (probed with ffprobe,
 * not trusted from the agent). Longer batches are rejected, not truncated.
 *
 * Model is fixed to Gemini Flash (non-thinking) and not exposed as a tool argument.
 * Tested against ground truth (reading on-screen text / HUD numbers from 360P–1080P
 * video, 2026-09): Flash was consistently accurate; Pro fabricated numbers, flipped
 * between runs and was 2x slower, so Pro is not used.
 */

import { createInterface } from 'readline';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const BASE_URL = (process.env.GEMINI_BASE_URL || 'http://127.0.0.1:8787/v1').replace(/\/+$/, '');
const API_KEY = process.env.GEMINI_API_KEY || 'sk-dummy';
const MODEL = 'gemini-3.5-flash';

const MAX_FILES = 9;
// gemini-go caps request bodies at 256 MiB; base64 inflates by 4/3.
const MAX_TOTAL_BYTES = 180 * 1024 * 1024;
const MAX_TOTAL_DURATION_SEC = 30 * 60;
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
// Remotion ships ffprobe; fall back to PATH.
const BUNDLED_FFPROBE = resolve(__dirname, '../node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
const FFPROBE = existsSync(BUNDLED_FFPROBE) ? BUNDLED_FFPROBE : 'ffprobe';

const MIME_TYPES = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.flv': 'video/x-flv',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.opus': 'audio/opus',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.pdf': 'application/pdf',
};

process.on('uncaughtException', (err) => {
  process.stderr.write(`[gemini-media-mcp] uncaught: ${err.message}\n`);
});
process.on('unhandledRejection', (err) => {
  process.stderr.write(`[gemini-media-mcp] unhandled rejection: ${err}\n`);
});

// ---------------------------------------------------------------------------
// HTTP — node:http instead of fetch: undici's 300s headersTimeout would abort
// long video analyses before Gemini finishes thinking. Also ignores HTTP_PROXY.
// ---------------------------------------------------------------------------

function postJson(url, body) {
  return new Promise((resolvePromise, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body));
    const req = lib.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        Authorization: `Bearer ${API_KEY}`,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolvePromise({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf-8') }));
      res.on('error', reject);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`request timed out after ${REQUEST_TIMEOUT_MS / 60000} min`)));
    req.on('error', reject);
    req.end(payload);
  });
}

function probeDuration(filePath) {
  return new Promise((resolvePromise, reject) => {
    execFile(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath], { timeout: 30000 }, (err, stdout, stderr) => {
      const sec = parseFloat(stdout);
      if (err || !Number.isFinite(sec)) return reject(new Error(`ffprobe failed for ${filePath}: ${(stderr || err?.message || stdout).trim().slice(0, 300)}`));
      resolvePromise(sec);
    });
  });
}

function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'analyze_media',
    description: `Analyze local video/audio/image files with Gemini Flash (${MODEL}), or send a text-only prompt when file_paths is omitted. Returns Gemini's text reply (often markdown with embedded JSON). Hard limits per call (rejected otherwise, split into batches): max ${MAX_FILES} files, total video/audio duration <= ${MAX_TOTAL_DURATION_SEC / 60} min, total size <= ${MAX_TOTAL_BYTES / 1024 / 1024} MB.`,
    inputSchema: {
      type: 'object',
      properties: {
        file_paths: {
          type: 'array',
          items: { type: 'string' },
          description: `Absolute paths of media files (0-${MAX_FILES}); omit for a text-only prompt`,
        },
        prompt: { type: 'string', description: 'Instruction for Gemini' },
        system_prompt: { type: 'string', description: 'Optional system prompt' },
      },
      required: ['prompt'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleAnalyzeMedia({ file_paths = [], prompt, system_prompt }) {
  if (!Array.isArray(file_paths)) throw new Error('file_paths must be an array');
  if (file_paths.length > MAX_FILES) throw new Error(`too many files (${file_paths.length}), max ${MAX_FILES} per call — split into batches`);
  if (!prompt) throw new Error('prompt is required');

  let totalBytes = 0;
  let totalSec = 0;
  const durations = [];
  for (const p of file_paths) {
    if (!isAbsolute(p)) throw new Error(`not an absolute path: ${p}`);
    const s = await stat(p).catch(() => null);
    if (!s?.isFile()) throw new Error(`file not found: ${p}`);
    totalBytes += s.size;
    const mime = MIME_TYPES[extname(p).toLowerCase()] || '';
    if (mime.startsWith('video/') || mime.startsWith('audio/') || !mime) {
      const sec = await probeDuration(p);
      totalSec += sec;
      durations.push(`${basename(p)} ${fmtDuration(sec)}`);
    }
  }
  if (totalSec > MAX_TOTAL_DURATION_SEC) {
    throw new Error(`total duration ${fmtDuration(totalSec)} exceeds ${MAX_TOTAL_DURATION_SEC / 60} min limit — split into batches (each <= ${MAX_TOTAL_DURATION_SEC / 60} min). Durations: ${durations.join(', ')}`);
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`total size ${(totalBytes / 1024 / 1024).toFixed(0)} MB exceeds ${MAX_TOTAL_BYTES / 1024 / 1024} MB — split into batches or use lower-quality copies`);
  }

  const fileParts = [];
  for (const p of file_paths) {
    const name = basename(p);
    const mime = MIME_TYPES[extname(p).toLowerCase()] || 'application/octet-stream';
    const b64 = (await readFile(p)).toString('base64');
    fileParts.push({ type: 'file', file: { file_data: `data:${mime};base64,${b64}`, filename: name, mime_type: mime } });
  }

  const messages = [];
  if (system_prompt) messages.push({ role: 'system', content: system_prompt });
  // Gemini doesn't see upload filenames, but agent prompts ask for "MM:SS + 文件名".
  const fileList = file_paths.map((p, i) => `${i + 1}. ${basename(p)}`).join('\n');
  const text = file_paths.length
    ? `附件按上传顺序依次为：\n${fileList}\n引用某个文件时请使用上面的文件名。\n\n${prompt}`
    : prompt;
  messages.push({ role: 'user', content: [...fileParts, { type: 'text', text }] });

  const started = Date.now();
  let res;
  try {
    res = await postJson(`${BASE_URL}/chat/completions`, { model: MODEL, messages, stream: false });
  } catch (err) {
    throw new Error(`cannot reach gemini-go at ${BASE_URL} (${err.message}) — is gemini-go.exe running?`);
  }
  if (res.status !== 200) throw new Error(`gemini-go HTTP ${res.status}: ${res.text.slice(0, 1000)}`);

  const data = JSON.parse(res.text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`empty reply from Gemini: ${res.text.slice(0, 1000)}`);
  process.stderr.write(`[gemini-media-mcp] ${MODEL}, ${file_paths.length} file(s), ${fmtDuration(totalSec)}, ${(totalBytes / 1024 / 1024).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  return content;
}

const HANDLERS = {
  analyze_media: handleAnalyzeMedia,
};

// ---------------------------------------------------------------------------
// MCP stdio transport (NDJSON — one JSON object per line)
// ---------------------------------------------------------------------------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handleMessage(JSON.parse(trimmed));
  } catch {
    // ignore non-JSON lines (e.g. Content-Length headers from some clients)
  }
});

// ---------------------------------------------------------------------------
// JSON-RPC message router
// ---------------------------------------------------------------------------

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'gemini-media-mcp', version: '1.0.0' },
      capabilities: { tools: {} },
    });
  }

  if (method === 'notifications/initialized') return;

  if (method === 'tools/list') {
    return reply(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    const handler = HANDLERS[name];
    if (!handler) return replyError(id, -32601, `Unknown tool: ${name}`);
    try {
      const result = await handler(args);
      return reply(id, {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
      });
    } catch (err) {
      process.stderr.write(`[gemini-media-mcp] tool "${name}" failed: ${err.message}\n`);
      return reply(id, {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  }

  if (id != null) replyError(id, -32601, `Method not found: ${method}`);
}
