#!/usr/bin/env node

/**
 * Bilibili MCP Server (stdio, NDJSON)
 *
 * Tools:
 *   bili_search      — Search videos or users on Bilibili
 *   bili_user_videos — List videos from an UP主
 *   bili_download    — Download video(s) via BBDown with serial queue
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
    description: 'Download Bilibili video(s) via BBDown. Requests are automatically queued — only one download runs at a time.',
    inputSchema: {
      type: 'object',
      properties: {
        urls:       { type: 'array', items: { type: 'string' }, description: 'Bilibili video URLs or BV IDs to download' },
        output_dir: { type: 'string', description: 'Output directory (e.g. "temp_analysis/sanguosha")' },
        quality:    { type: 'string', enum: ['preview', 'hq'], description: '"preview" = 360P, "hq" = 1080P 高码率', default: 'preview' },
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
    name: 'bbdown_raw',
    description: 'Run BBDown with arbitrary arguments. Downloads are automatically queued.',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'BBDown command-line arguments (e.g. ["BV1xxx", "--work-dir", "temp_analysis/", "-q", "1080P 高码率"])' },
      },
      required: ['args'],
    },
  },
];

// ---------------------------------------------------------------------------
// CLI execution helpers
// ---------------------------------------------------------------------------

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
      else resolve(stdout);
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
  const qualityStr = quality === 'hq' ? '1080P 高码率, 1080P 高清' : '360P 流畅';

  const results = await enqueueDownload(async () => {
    const out = [];
    for (const url of urls) {
      const bvid = extractBvid(url);
      const args = [
        url.startsWith('http') ? url : `https://www.bilibili.com/video/${bvid}/`,
        '--work-dir', output_dir,
        '-q', qualityStr,
        '--skip-subtitle', '--skip-cover', '--skip-ai',
        '-F', bvid,
      ];
      try {
        const output = await runCmd('BBDown', args);
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

async function handleBBDownRaw({ args }) {
  const output = await enqueueDownload(() => runCmd('BBDown', args));
  return output.slice(-4000);
}

const HANDLERS = {
  bili_search: handleSearch,
  bili_user_videos: handleUserVideos,
  bili_download: handleDownload,
  bili_raw: handleBiliRaw,
  bbdown_raw: handleBBDownRaw,
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
