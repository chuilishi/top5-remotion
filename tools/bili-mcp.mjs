#!/usr/bin/env node

/**
 * Bilibili MCP Server (stdio, NDJSON)
 *
 * Tools:
 *   bili_search      — Search videos or users on Bilibili
 *   bili_user_videos — List videos from an UP主
 *   bili_download    — Download video(s) via yutto with serial queue
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

process.on('uncaughtException', (err) => {
  process.stderr.write(`[bili-mcp] uncaught: ${err.message}\n`);
});
process.on('unhandledRejection', (err) => {
  process.stderr.write(`[bili-mcp] unhandled rejection: ${err}\n`);
});

// ---------------------------------------------------------------------------
// NDJSON stdio transport
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
    // ignore non-JSON lines
  }
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'bili_search',
    description: 'Search Bilibili for videos or users. Returns structured JSON results.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword:     { type: 'string', description: 'Search keyword' },
        type:        { type: 'string', enum: ['video', 'user'], description: 'Search type (default "video")', default: 'video' },
        max_results: { type: 'number', description: 'Number of results (default 20)', default: 20 },
        page:        { type: 'number', description: 'Page number (default 1)', default: 1 },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'bili_user_videos',
    description: 'List videos from a Bilibili UP主 (content creator). Accepts UID (number) or username.',
    inputSchema: {
      type: 'object',
      properties: {
        uid_or_name: { type: 'string', description: 'UP主 UID (number) or username' },
        max_results: { type: 'number', description: 'Number of videos to list (default 30)', default: 30 },
      },
      required: ['uid_or_name'],
    },
  },
  {
    name: 'bili_download',
    description: 'Download Bilibili video(s) via yutto, saved as {BV号}.mp4 (H.264). Requests are automatically queued — only one download runs at a time.',
    inputSchema: {
      type: 'object',
      properties: {
        urls:       { type: 'array', items: { type: 'string' }, description: 'Bilibili video URLs or BV IDs to download' },
        output_dir: { type: 'string', description: 'Output directory (e.g. "temp_analysis/sanguosha")' },
        quality:    { type: 'string', enum: ['preview', 'hq'], description: '"preview" = 360P, "hq" = 1080P（非大会员拿不到 1080P+ 高码率）', default: 'preview' },
      },
      required: ['urls', 'output_dir'],
    },
  },
  {
    name: 'bili_raw',
    description: 'Run bili CLI with arbitrary arguments. Use for edge cases (e.g. coin, like, favorites, history).',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'bili command-line arguments (e.g. ["user", "12345"])' },
      },
      required: ['args'],
    },
  },
  {
    name: 'yutto_raw',
    description: 'Run yutto with arbitrary arguments. Downloads are automatically queued.',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'yutto command-line arguments. For downloads include "-x", "no" — yutto otherwise uses the Windows system proxy (e.g. ["BV1xxx", "-x", "no", "-d", "temp_analysis/", "-q", "80"])' },
      },
      required: ['args'],
    },
  },
];

// ---------------------------------------------------------------------------
// CLI execution helpers
// ---------------------------------------------------------------------------

// B站是境内站，必须直连：经境外代理出去会被风控拦成 HTTP 412。
// 这里只清环境变量；yutto 另外默认（-x auto）会读 Windows 系统代理，下载参数里要显式 -x no。
// PYTHONUTF8 让 bili / yutto（都是 Python）在管道下输出 UTF-8，否则 Windows 上是 GBK。
const childEnv = { ...process.env, PYTHONUTF8: '1' };
for (const k of Object.keys(childEnv)) {
  if (/^(https?|all)_proxy$/i.test(k)) delete childEnv[k];
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: childEnv });
    const stdout = [], stderr = [];
    proc.stdout.on('data', (d) => { stdout.push(d); });
    proc.stderr.on('data', (d) => { stderr.push(d); });
    proc.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf-8');
      if (code === 0) return resolve(out);
      const detail = Buffer.concat(stderr).toString('utf-8').trim() || out.trim().slice(-500);
      reject(new Error(`${cmd} exited ${code}: ${detail.slice(0, 500)}`));
    });
    proc.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Download queue (Promise chain)
// ---------------------------------------------------------------------------

let downloadQueue = Promise.resolve();

function enqueueDownload(fn) {
  return new Promise((resolve, reject) => {
    downloadQueue = downloadQueue
      .then(() => fn())
      .then(resolve, reject);
  });
}

// ---------------------------------------------------------------------------
// Extract BV ID from URL or raw ID
// ---------------------------------------------------------------------------

function extractBvid(urlOrId) {
  const match = urlOrId.match(/BV[\w]+/);
  return match ? match[0] : urlOrId;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleSearch({ keyword, type = 'video', max_results = 20, page = 1 }) {
  const args = ['search', keyword, '--type', type, '--max', String(max_results), '--page', String(page), '--json'];
  const output = await runCmd('bili', args);
  try {
    return JSON.parse(output);
  } catch {
    return output.trim();
  }
}

async function handleUserVideos({ uid_or_name, max_results = 30 }) {
  const args = ['user-videos', uid_or_name, '--max', String(max_results), '--json'];
  const output = await runCmd('bili', args);
  try {
    return JSON.parse(output);
  } catch {
    return output.trim();
  }
}

async function handleDownload({ urls, output_dir, quality = 'preview' }) {
  // yutto 取不到请求的清晰度时自动往下降：112(1080P+) 需大会员，否则落到 80(1080P)
  const qn = quality === 'hq' ? '112' : '16';

  const results = await enqueueDownload(async () => {
    const out = [];
    for (const url of urls) {
      const bvid = extractBvid(url);
      const args = [
        url.startsWith('http') ? url : `https://www.bilibili.com/video/${bvid}/`,
        '-d', output_dir,
        '-x', 'no',
        '-q', qn,
        '--vcodec', 'avc:copy',
        '-tp', '{bvid}',
        '--no-danmaku', '--no-subtitle', '--no-cover', '--no-chapter-info',
        '--no-color', '--no-progress',
      ];
      try {
        const output = await runCmd('yutto', args);
        out.push({ bvid, status: 'ok', output: output.slice(-500) });
      } catch (err) {
        out.push({ bvid, status: 'error', error: err.message.slice(0, 500) });
      }
    }
    return out;
  });

  return results;
}

async function handleBiliRaw({ args }) {
  const output = await runCmd('bili', args);
  return output.slice(-4000);
}

async function handleYuttoRaw({ args }) {
  const output = await enqueueDownload(() => runCmd('yutto', args));
  return output.slice(-4000);
}

const HANDLERS = {
  bili_search: handleSearch,
  bili_user_videos: handleUserVideos,
  bili_download: handleDownload,
  bili_raw: handleBiliRaw,
  yutto_raw: handleYuttoRaw,
};

// ---------------------------------------------------------------------------
// JSON-RPC message router
// ---------------------------------------------------------------------------

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'bili-mcp', version: '1.0.0' },
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
      return reply(id, {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  }

  if (id != null) replyError(id, -32601, `Method not found: ${method}`);
}
