#!/usr/bin/env node
import { readFileSync } from 'fs';
import { basename } from 'path';

const BASE = 'http://localhost:8000';
const API = `${BASE}/v1/chat/completions`;
const FILES_API = `${BASE}/v1/files`;
const KEY = 'sk-dummy';

const args = process.argv.slice(2);
let model = 'gemini-3.0-flash-thinking';
let prompt = '';
let systemPrompt = '';
const videoPaths = [];

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '-m' || args[i] === '--model') && args[i + 1]) {
    model = args[++i];
  } else if ((args[i] === '-s' || args[i] === '--system') && args[i + 1]) {
    systemPrompt = args[++i];
  } else if ((args[i] === '-v' || args[i] === '--video') && args[i + 1]) {
    videoPaths.push(args[++i]);
  } else {
    prompt = args[i];
  }
}

if (!prompt) {
  console.error('Usage: gemini.mjs [-m model] [-s system_prompt] [-v video.mp4 ...] "prompt"');
  console.error('Models: gemini-3.0-flash, gemini-3.0-flash-thinking (default), gemini-3.0-pro');
  process.exit(1);
}

async function uploadFile(filePath) {
  const data = readFileSync(filePath);
  const name = basename(filePath);
  const form = new FormData();
  form.append('file', new Blob([data]), name);
  form.append('purpose', 'assistants');
  const res = await fetch(FILES_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${name}): ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.id;
}

let content;
if (videoPaths.length > 0) {
  const fileIds = await Promise.all(videoPaths.map(uploadFile));
  content = [
    ...fileIds.map(id => ({ type: 'file', file: { file_id: id } })),
    { type: 'text', text: prompt },
  ];
} else {
  content = prompt;
}

const messages = [];
if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
messages.push({ role: 'user', content });

const res = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ model, messages, stream: false }),
});

if (!res.ok) {
  console.error(`Error ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
console.log(data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2));
