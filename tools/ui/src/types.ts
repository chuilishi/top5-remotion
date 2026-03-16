export interface ClipData {
  src: string;
  durationSec: number;
  offsetSec?: number;
  startFrom?: number;
  paddedDurationSec?: number;
}

export interface SubtitleData {
  text: string;
  startSec: number;
  durationSec: number;
}

export interface StatData {
  value: string;
  startSec: number;
  durationSec: number;
}

export interface GameData {
  rank: number;
  titleEn: string;
  titleZh?: string;
  bgColor?: string;
  clips: ClipData[];
  subtitles?: SubtitleData[];
  stats?: StatData[];
}
