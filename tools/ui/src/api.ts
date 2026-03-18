import type { GameData } from './types';

export interface ProjectInfo {
  projects: { name: string; hasConfig: boolean }[];
  current: string | null;
}

export async function fetchProjects(): Promise<ProjectInfo> {
  const res = await fetch('/api/projects');
  return res.json();
}

export async function switchProject(name: string): Promise<void> {
  await fetch('/api/switch-project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function saveProject(): Promise<void> {
  await fetch('/api/save-project', { method: 'POST' });
}

export async function fetchGames(): Promise<GameData[]> {
  const res = await fetch('/api/config');
  return res.json();
}

export async function fetchGameDetail(rank: number): Promise<GameData | null> {
  try {
    const res = await fetch(`/api/game-detail?rank=${rank}`);
    return res.json();
  } catch {
    return null;
  }
}

export async function saveGameName(rank: number, titleEn: string, titleZh: string) {
  await fetch('/api/game-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rank, titleEn, titleZh }),
  });
}

export async function saveTiming(
  rank: number,
  subtitles: GameData['subtitles'],
  stats: GameData['stats'],
  clips: GameData['clips'],
  voiceover?: GameData['voiceover'],
) {
  await fetch('/api/save-timing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rank, subtitles, stats, clips, voiceover }),
  });
}

export interface AutoParams {
  urls: string[];
  topic: string;
  rank: number;
  folderName: string;
  apiBase: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

export type StreamMsg =
  | { type: 'log'; data: string }
  | { type: 'json'; data: string }
  | { type: 'done'; data: { clips: unknown[]; totalDur: number } }
  | { type: 'error'; data: string };

export async function* streamAuto(params: AutoParams): AsyncGenerator<StreamMsg> {
  const res = await fetch('/api/auto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as StreamMsg;
      } catch {}
    }
  }
}
