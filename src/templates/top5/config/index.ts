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

const PRE_FINAL_BEAT_SEC = 72;
const MIN_TAIL_BUFFER_SEC = 0.3;
const BUFFER_WARN_HIGH_SEC = 1.5;
const RANK1_TAIL_BUFFER_SEC = 3.7;

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

function computeTiming(content: ContentConfig): ContentConfig {
  const games = content.games || [];
  if (!content.timing) content.timing = {} as ContentConfig["timing"];

  const existingGameplayDurations = Array.isArray(content.timing.gameplayDurations)
    ? [...content.timing.gameplayDurations]
    : [];
  const minGameplayDurations = games.map((game, i) => {
    const vo = game.voiceover;
    if (vo && vo.length > 0) {
      const last = vo[vo.length - 1];
      if (last && (last.offsetSec > 0 || last.durationSec > 0)) {
        return last.offsetSec + last.durationSec + MIN_TAIL_BUFFER_SEC;
      }
    }
    return existingGameplayDurations[i] ?? 20;
  });

  const gameplayDurations = [...minGameplayDurations];
  const adjustableCount = Math.max(0, games.length - 1);
  const introDuration = content.timing.introDuration ?? 2;
  const rankTransitionDurations = Array.isArray(content.timing.rankTransitionDurations)
    ? content.timing.rankTransitionDurations
    : [];

  if (adjustableCount > 0) {
    const allTransitions = rankTransitionDurations
      .reduce((sum: number, val: number) => sum + (Number(val) || 0), 0);
    const gameplayBeforeFinal = minGameplayDurations
      .slice(0, adjustableCount)
      .reduce((sum: number, val: number) => sum + val, 0);
    const remainingBuffer = PRE_FINAL_BEAT_SEC - introDuration - allTransitions - gameplayBeforeFinal;

    if (remainingBuffer < 0) {
      console.error(
        `ERROR: ${PRE_FINAL_BEAT_SEC}s beat exceeded by ${Math.abs(remainingBuffer).toFixed(1)}s`
      );
    }

    const perRankBuffer = MIN_TAIL_BUFFER_SEC + Math.max(0, remainingBuffer / adjustableCount);
    if (perRankBuffer > BUFFER_WARN_HIGH_SEC) {
      const excessTotal = (perRankBuffer - BUFFER_WARN_HIGH_SEC) * adjustableCount;
      console.warn(
        `Warning: per-rank buffer ${perRankBuffer.toFixed(1)}s > ${BUFFER_WARN_HIGH_SEC}s — 配音过短，建议增加约 ${excessTotal.toFixed(1)}s 文案`
      );
    }

    const avg = remainingBuffer / adjustableCount;
    let rest = remainingBuffer;
    for (let i = 0; i < adjustableCount; i++) {
      const bonus = i === adjustableCount - 1 ? rest : avg;
      gameplayDurations[i] += bonus;
      rest -= bonus;
    }
    gameplayDurations[adjustableCount] += (RANK1_TAIL_BUFFER_SEC - MIN_TAIL_BUFFER_SEC);
  }

  content.timing.gameplayDurations = gameplayDurations;
  return content;
}

let cachedContent: ContentConfig | null = null;

export async function loadContentConfig(): Promise<ContentConfig> {
  if (cachedContent) return cachedContent;
  const project = await readJson("_active/project.json") as ContentConfig;
  project.games = await loadRankFiles();
  cachedContent = computeTiming(project);
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
