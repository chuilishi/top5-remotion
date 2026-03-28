#!/usr/bin/env node

/**
 * ffmpeg MCP Server (stdio, NDJSON)
 *
 * Tools:
 *   ffmpeg_raw — Run ffmpeg with arbitrary arguments
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

process.on('uncaughtException', (err) => {
  process.stderr.write(`[ffmpeg-mcp] uncaught: ${err.message}\n`);
});
process.on('unhandledRejection', (err) => {
  process.stderr.write(`[ffmpeg-mcp] unhandled rejection: ${err}\n`);
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
    name: 'ffmpeg_raw',
    description: 'Run ffmpeg with arbitrary arguments. Supports any ffmpeg operation: cutting, encoding, thumbnailing, probing, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'ffmpeg arguments as an array (e.g. ["-y", "-ss", "10", "-i", "input.mp4", "-frames:v", "1", "out.jpg"])' },
      },
      required: ['args'],
    },
  },
  {
    name: 'ffprobe_raw',
    description: 'Run ffprobe to inspect media file metadata (duration, resolution, codecs, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'ffprobe arguments as an array (e.g. ["-v", "error", "-show_format", "-show_streams", "input.mp4"])' },
      },
      required: ['args'],
    },
  },
];

// ---------------------------------------------------------------------------
// Execution helper
// ---------------------------------------------------------------------------

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 2000)}`));
      else resolve(stdout || stderr.slice(0, 4000));
    });
    proc.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleFfmpeg({ args }) {
  const output = await runCmd('ffmpeg', args);
  return output.slice(-4000);
}

async function handleFfprobe({ args }) {
  const output = await runCmd('ffprobe', args);
  return output.slice(-4000);
}

const HANDLERS = {
  ffmpeg_raw: handleFfmpeg,
  ffprobe_raw: handleFfprobe,
};

// ---------------------------------------------------------------------------
// JSON-RPC message router
// ---------------------------------------------------------------------------

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'ffmpeg-mcp', version: '1.0.0' },
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
