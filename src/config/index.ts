// ============================================================
//  配置统一入口
//
//  组件中使用:
//    import { contentConfig, styleConfig } from "../config";
//    import type { ContentConfig, StyleConfig, GameItem } from "../config";
// ============================================================

export { default as contentConfig } from "./content.config";
export { default as styleConfig } from "./style.config";
export type {
  ContentConfig,
  StyleConfig,
  GradientStop,
  GameItem,
  SubtitleLine,
  StatDisplay,
  VideoClip,
} from "./types";

// ──────────── 时间线计算工具 ────────────

import type { ContentConfig } from "./types";

/**
 * 计算视频总帧数
 */
export function calculateTotalFrames(data: ContentConfig): number {
  const { timing, fps } = data;
  let totalSec = timing.introDuration;
  for (let i = 0; i < data.games.length; i++) {
    totalSec += timing.rankTransitionDuration;
    totalSec += timing.titleCardDuration;
    totalSec += timing.gameplayDurations[i];
  }
  totalSec += timing.endingDuration;
  return Math.ceil(totalSec * fps);
}

/**
 * 计算各片段的起始帧和时长
 */
export function calculateSegments(data: ContentConfig) {
  const { timing, fps } = data;
  const segments: Array<{
    type: "intro" | "rankTransition" | "titleCard" | "gameplay" | "ending";
    startFrame: number;
    durationFrames: number;
    gameIndex?: number;
  }> = [];

  let currentFrame = 0;

  const introFrames = Math.round(timing.introDuration * fps);
  segments.push({ type: "intro", startFrame: currentFrame, durationFrames: introFrames });
  currentFrame += introFrames;

  for (let i = 0; i < data.games.length; i++) {
    const transFrames = Math.round(timing.rankTransitionDuration * fps);
    segments.push({ type: "rankTransition", startFrame: currentFrame, durationFrames: transFrames, gameIndex: i });
    currentFrame += transFrames;

    const titleFrames = Math.round(timing.titleCardDuration * fps);
    segments.push({ type: "titleCard", startFrame: currentFrame, durationFrames: titleFrames, gameIndex: i });
    currentFrame += titleFrames;

    const gameplayFrames = Math.round(timing.gameplayDurations[i] * fps);
    segments.push({ type: "gameplay", startFrame: currentFrame, durationFrames: gameplayFrames, gameIndex: i });
    currentFrame += gameplayFrames;
  }

  const endingFrames = Math.round(timing.endingDuration * fps);
  segments.push({ type: "ending", startFrame: currentFrame, durationFrames: endingFrames });

  return segments;
}
