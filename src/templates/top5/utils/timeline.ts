import type { VideoClip, VoiceoverClip } from "../config/types";

export interface ResolvedClip {
  src: string;
  startFrom: number;
  durationSec: number;
  offsetSec: number;
  paddedDurationSec?: number;
}

export function resolveClipLayout(clips: VideoClip[]): ResolvedClip[] {
  let cumulative = 0;
  return clips.map((c) => {
    const offset = c.offsetSec ?? cumulative;
    cumulative += c.durationSec;
    return {
      src: c.src,
      startFrom: c.startFrom ?? 0,
      durationSec: c.durationSec,
      offsetSec: offset,
      paddedDurationSec: c.paddedDurationSec,
    };
  });
}

export function computeClipsDuration(clips: VideoClip[]): number {
  if (!clips.length) return 0;
  const resolved = resolveClipLayout(clips);
  return Math.max(...resolved.map((c) => c.offsetSec + c.durationSec));
}

export function computeVoiceDurations(
  voiceover: VoiceoverClip[],
  gameplayDurationSec: number,
): number[] {
  return voiceover.map((vo, i) => {
    const nextOffset =
      i < voiceover.length - 1
        ? voiceover[i + 1].offsetSec
        : gameplayDurationSec;
    return Math.max(0.1, nextOffset - vo.offsetSec);
  });
}
