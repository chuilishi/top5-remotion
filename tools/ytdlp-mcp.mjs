#!/usr/bin/env node

/**
 * yt-dlp MCP Server (stdio) — Multi-account with per-account proxy & load balancing
 *
 * Tools:
 *   ytdlp_search       — YouTube search, returns structured metadata
 *   ytdlp_channel_list — List channel videos
 *   ytdlp_download     — Download video(s) with per-account serial queue & load balancing
 *   ytdlp_raw          — Run yt-dlp with arbitrary arguments
 *
 * Accounts config (ytdlp-accounts.json next to this file):
 *   [{ "id": "main", "cookies": "path/to/cookies.txt", "proxy": "socks5://host:port" }, ...]
 *   Falls back to a single default account with no cookies/proxy if file is missing.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

process.on('uncaughtException', (err) => {
  process.stderr.write(`[ytdlp-mcp] uncaught: ${err.message}\n`);
});
process.on('unhandledRejection', (err) => {
  process.stderr.write(`[ytdlp-mcp] unhandled rejection: ${err}\n`);
});

// ---------------------------------------------------------------------------
// Account loading & load balancer
// ---------------------------------------------------------------------------

function loadAccounts() {
  const configPath = resolve(__dirname, 'ytdlp-accounts.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) throw new Error('empty');
    return list.map((a) => ({
      id: a.id || 'unnamed',
      cookies: a.cookies ? (isAbsolute(a.cookies) ? a.cookies : resolve(__dirname, a.cookies)) : null,
      cookies_from_browser: a.cookies_from_browser || null,
      proxy: a.proxy || null,
    }));
  } catch {
    process.stderr.write('[ytdlp-mcp] No valid ytdlp-accounts.json — using single default account\n');
    return [{ id: 'default', cookies: null, cookies_from_browser: null, proxy: null }];
  }
}

const accounts = loadAccounts();

const accountState = new Map();
for (const acc of accounts) {
  accountState.set(acc.id, { queue: Promise.resolve(), pending: 0 });
}

let rrIndex = 0;

function selectAccount() {
  let best = null;
  let bestPending = Infinity;
  for (let i = 0; i < accounts.length; i++) {
    const idx = (rrIndex + i) % accounts.length;
    const acc = accounts[idx];
    const state = accountState.get(acc.id);
    if (state.pending < bestPending) {
      bestPending = state.pending;
      best = acc;
    }
  }
  rrIndex = (accounts.indexOf(best) + 1) % accounts.length;
  return best;
}

function enqueueForAccount(account, fn) {
  const state = accountState.get(account.id);
  state.pending++;
  return new Promise((resolve, reject) => {
    state.queue = state.queue
      .then(() => fn())
      .then((result) => { state.pending--; resolve(result); })
      .catch((err) => { state.pending--; reject(err); });
  });
}

function accountArgs(account) {
  const args = [];
  if (account.cookies) {
    args.push('--cookies', account.cookies);
  } else if (account.cookies_from_browser) {
    args.push('--cookies-from-browser', account.cookies_from_browser);
  }
  if (account.proxy) args.push('--proxy', account.proxy);
  return args;
}

function resolveAccount(account_id) {
  if (account_id) {
    const acc = accounts.find((a) => a.id === account_id);
    if (!acc) throw new Error(`Unknown account: ${account_id}. Available: ${accounts.map(a => a.id).join(', ')}`);
    return acc;
  }
  return selectAccount();
}

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
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'ytdlp_search',
    description: 'Search YouTube and return structured video metadata. Does NOT download anything.',
    inputSchema: {
      type: 'object',
      properties: {
        query:       { type: 'string', description: 'Search query (e.g. "Godot game showcase")' },
        max_results: { type: 'number', description: 'Number of results (default 10)', default: 10 },
        account_id:  { type: 'string', description: 'Force a specific account ID. Omit for auto load-balance.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'ytdlp_channel_list',
    description: 'List videos from a YouTube channel URL. Does NOT download anything.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_url: { type: 'string', description: 'Channel URL (e.g. https://www.youtube.com/@ChannelHandle/videos)' },
        max_items:   { type: 'number', description: 'Max videos to list (default 30)', default: 30 },
        account_id:  { type: 'string', description: 'Force a specific account ID. Omit for auto load-balance.' },
      },
      required: ['channel_url'],
    },
  },
  {
    name: 'ytdlp_download',
    description: 'Download YouTube video(s). Each account runs its own serial queue — multiple accounts download in parallel. Load-balanced by least-busy account.',
    inputSchema: {
      type: 'object',
      properties: {
        urls:       { type: 'array', items: { type: 'string' }, description: 'YouTube video URLs to download' },
        output_dir: { type: 'string', description: 'Output directory (e.g. "temp_analysis/godot")' },
        quality:    { type: 'string', enum: ['preview', 'hq'], description: '"preview" = worst[height>=360], "hq" = bestvideo[height<=1080]+bestaudio', default: 'preview' },
        filename_template: { type: 'string', description: 'Output filename template (default "%(id)s.mp4" for preview, "hq_%(id)s.mp4" for hq)' },
        account_id: { type: 'string', description: 'Force a specific account ID. Omit for auto load-balance.' },
      },
      required: ['urls', 'output_dir'],
    },
  },
  {
    name: 'ytdlp_raw',
    description: 'Run yt-dlp with arbitrary arguments. Downloads are queued per-account if --no-download is NOT present.',
    inputSchema: {
      type: 'object',
      properties: {
        args:       { type: 'array', items: { type: 'string' }, description: 'yt-dlp command-line arguments as an array (e.g. ["-F", "https://..."])' },
        account_id: { type: 'string', description: 'Force a specific account ID. Omit for auto load-balance.' },
      },
      required: ['args'],
    },
  },
];

// ---------------------------------------------------------------------------
// yt-dlp execution
// ---------------------------------------------------------------------------

function runYtdlp(args, account = null) {
  const extraArgs = account ? accountArgs(account) : [];
  const allArgs = [...extraArgs, ...args];
  const accLabel = account ? ` [${account.id}]` : '';
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', allArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => {
      stderr += d;
      process.stderr.write(d);
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        const errMsg = `yt-dlp${accLabel} exited ${code}: ${stderr.slice(0, 1000)}`;
        process.stderr.write(`[ytdlp-mcp] ERROR: ${errMsg}\n`);
        reject(new Error(errMsg));
      } else {
        resolve(stdout);
      }
    });
    proc.on('error', (err) => {
      process.stderr.write(`[ytdlp-mcp] spawn error${accLabel}: ${err.message}\n`);
      reject(err);
    });
  });
}

function parseMetadataLines(output) {
  return output.trim().split('\n').filter(Boolean).map((line) => {
    const parts = line.split(' | ').map((s) => s.trim());
    return {
      id: parts[0] || '',
      title: parts[1] || '',
      duration: parts[2] || '',
      view_count: parts[3] || '',
      channel: parts[4] || undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleSearch({ query, max_results = 10, account_id }) {
  const account = resolveAccount(account_id);
  const n = Math.min(Math.max(1, max_results), 50);
  const output = await runYtdlp([
    `ytsearch${n}:${query}`,
    '--flat-playlist',
    '--print', '%(id)s | %(title)s | %(duration)s | %(view_count)s | %(channel)s',
    '--no-download',
  ], account);
  return parseMetadataLines(output);
}

async function handleChannelList({ channel_url, max_items = 30, account_id }) {
  const account = resolveAccount(account_id);
  const n = Math.min(Math.max(1, max_items), 100);
  const output = await runYtdlp([
    channel_url,
    '--flat-playlist',
    '--print', '%(id)s | %(title)s | %(duration)s | %(view_count)s',
    '--no-download',
    '--playlist-items', `1:${n}`,
  ], account);
  return parseMetadataLines(output);
}

async function handleDownload({ urls, output_dir, quality = 'preview', filename_template, account_id }) {
  const fmt = quality === 'hq'
    ? 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'
    : 'worst[height>=360]';
  const tpl = filename_template || (quality === 'hq' ? 'hq_%(id)s.mp4' : '%(id)s.mp4');
  const baseArgs = [
    '-f', fmt,
    '--merge-output-format', 'mp4',
    '--no-download-archive',
    '--no-part',
    '--force-overwrites',
    '--socket-timeout', '15',
    '-o', `${output_dir}/${tpl}`,
  ];

  const tasks = urls.map((url) => {
    const account = resolveAccount(account_id);
    return enqueueForAccount(account, async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          process.stderr.write(`[ytdlp-mcp] download ${url} via "${account.id}"${attempt > 1 ? ` (retry ${attempt})` : ''}${account.proxy ? ` proxy=${account.proxy}` : ''}\n`);
          const output = await runYtdlp([...baseArgs, url], account);
          return { url, account: account.id, output: output.slice(-500) };
        } catch (err) {
          if (attempt >= 2) throw err;
          process.stderr.write(`[ytdlp-mcp] ${url} failed on "${account.id}", retrying in 3s...\n`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    });
  });

  const results = await Promise.allSettled(tasks);
  const summary = results.map((r, i) => {
    if (r.status === 'fulfilled') return { url: urls[i], status: 'ok', account: r.value.account };
    return { url: urls[i], status: 'error', error: r.reason?.message?.slice(0, 300) };
  });

  return { status: 'ok', downloads: summary };
}

async function handleRaw({ args, account_id }) {
  const account = resolveAccount(account_id);
  const isDownload = !args.includes('--no-download');
  const run = () => runYtdlp(args, account);
  const output = isDownload ? await enqueueForAccount(account, run) : await run();
  return output.slice(-4000);
}

const HANDLERS = {
  ytdlp_search: handleSearch,
  ytdlp_channel_list: handleChannelList,
  ytdlp_download: handleDownload,
  ytdlp_raw: handleRaw,
};

// ---------------------------------------------------------------------------
// JSON-RPC message router
// ---------------------------------------------------------------------------

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'ytdlp-mcp', version: '1.0.0' },
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
      process.stderr.write(`[ytdlp-mcp] tool "${name}" failed: ${err.message}\n`);
      return reply(id, {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  }

  if (id != null) replyError(id, -32601, `Method not found: ${method}`);
}
