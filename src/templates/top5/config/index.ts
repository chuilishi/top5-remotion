// ============================================================
//  配置统一入口
//
//  styleConfig: 静态导入（手维护的 TS 文件）
//  contentConfig: 运行时由 calculateMetadata 加载，通过 props 传递
//
//  组件中使用:
//    import { styleConfig } from "../config";
//    import type { ContentConfig, StyleConfig, GameItem } from "../config";
// ============================================================

export { default as styleConfig } from "./style.config";
export type {
  ContentConfig,
  StyleConfig,
  GradientStop,
  GameItem,
  SubtitleLine,
  StatDisplay,
  VideoClip,
  BrandVoiceoverClip,
} from "./types";

// ──────────── 运行时内容加载 ────────────

import { staticFile } from "remotion";
import type { ContentConfig } from "./types";

async function readJson(relativePath: string): Promise<unknown> {
  const res = await fetch(staticFile(relativePath));
  if (!res.ok) return null;
  return res.json();
}

async function loadRankFiles(): Promise<ContentConfig["games"]> {
  const manifest = await readJson("_active/ranks/index.json") as string[] | null;
  if (!manifest || manifest.length === 0) return [];
  const rankFiles = manifest.filter((f) => /^rank_\d+_.+\.json$/.test(f));
  const games = await Promise.all(
    rankFiles.map((f) => readJson(`_active/ranks/${f}`))
  );
  return (games.filter(Boolean) as ContentConfig["games"]).sort(
    (a, b) => b.rank - a.rank
  );
}

let cachedContent: ContentConfig | null = null;

export async function loadContentConfig(): Promise<ContentConfig> {
  if (cachedContent) return cachedContent;
  const project = await readJson("_active/project.json") as ContentConfig;
  project.games = await loadRankFiles();
  cachedContent = project;
  return cachedContent;
}

// ──────────── 时间线计算工具 ────────────

/**
 * 计算视频总帧数
 */
export function calculateTotalFrames(data: ContentConfig): number {
  const { timing, fps } = data;
  let totalSec = timing.introDuration;
  for (let i = 0; i < data.games.length; i++) {
    totalSec += timing.rankTransitionDurations[i];
    totalSec += timing.gameplayDurations[i];
  }
  return Math.ceil(totalSec * fps);
}

/**
 * 计算各片段的起始帧和时长
 */
export function calculateSegments(data: ContentConfig) {
  const { timing, fps } = data;
  const segments: Array<{
    type: "intro" | "rankTransition" | "gameplay";
    startFrame: number;
    durationFrames: number;
    gameIndex?: number;
  }> = [];

  let currentFrame = 0;

  const introFrames = Math.round(timing.introDuration * fps);
  segments.push({ type: "intro", startFrame: currentFrame, durationFrames: introFrames });
  currentFrame += introFrames;

  for (let i = 0; i < data.games.length; i++) {
    const transFrames = Math.round(timing.rankTransitionDurations[i] * fps);
    segments.push({ type: "rankTransition", startFrame: currentFrame, durationFrames: transFrames, gameIndex: i });
    currentFrame += transFrames;

    const gameplayFrames = Math.round(timing.gameplayDurations[i] * fps);
    segments.push({ type: "gameplay", startFrame: currentFrame, durationFrames: gameplayFrames, gameIndex: i });
    currentFrame += gameplayFrames;
  }

  return segments;
}
