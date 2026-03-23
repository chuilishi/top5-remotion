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
