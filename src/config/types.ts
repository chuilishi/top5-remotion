// ============================================================
//  类型定义 — content 和 style 两份配置共用
// ============================================================

// ──────────── Content 相关类型 ────────────

export interface SubtitleLine {
  text: string;
  /** 相对于该游戏 gameplay 段开始的时间(秒) */
  startSec: number;
  /** 持续时间(秒) */
  durationSec: number;
}

export interface StatDisplay {
  /** 大数字文本, 例如 "146,000,000+" */
  value: string;
  /** 相对于该游戏 gameplay 段开始的时间(秒) */
  startSec: number;
  durationSec: number;
}

export interface VideoClip {
  /** 视频文件路径，相对于 public/ 文件夹 */
  src: string;
  /** 从原视频文件的第几秒开始播放（入点裁剪），不填则从头 */
  startFrom?: number;
  /** 该片段在最终视频中持续多少秒 */
  durationSec: number;
  /** 该片段在 gameplay 时间线上的起始位置(秒)，不填则按顺序拼接 */
  offsetSec?: number;
  /** 带容差的原始文件时长(秒)，用于编辑器微调范围 */
  paddedDurationSec?: number;
}

export interface VoiceoverClip {
  /** 音频文件路径，相对于 public/ 文件夹 */
  src: string;
  /** 对应的旁白文案 */
  text: string;
  /** 在 gameplay 时间线上的起始位置(秒) */
  offsetSec: number;
}

export interface GameItem {
  rank: number;
  titleEn: string;
  titleZh?: string;
  subtitles: SubtitleLine[];
  stats?: StatDisplay[];
  clips?: VideoClip[];
  voiceover?: VoiceoverClip[];
  /** 单视频兼容字段（旧方式），若同时提供了 clips 则优先 clips */
  videoSrc?: string;
  /** 无视频时的占位背景色 */
  bgColor?: string;
}

export interface ContentConfig {
  titleLine1: string;
  titleLine2: string;
  watermark: string;
  fps: number;
  width: number;
  height: number;
  games: GameItem[];
  timing: {
    introDuration: number;
    /** 每个排名的转场时长(秒)，数组长度 = games.length */
    rankTransitionDurations: number[];
    /** 每个排名的标题卡时长(秒)，数组长度 = games.length */
    titleCardDurations: number[];
    /** 每个游戏的 gameplay 段总时长，应等于 clips[].durationSec 之和 */
    gameplayDurations: number[];
  };
}

// ──────────── Style 相关类型 ────────────

export interface GradientStop {
  offset: string;
  color: string;
}

export interface StyleConfig {
  /** 字体族 */
  fonts: {
    title: string;
    subtitle: string;
    stat: string;
    watermark: string;
  };

  /** 配色方案 */
  colors: {
    /** 全局背景色 */
    globalBg: string;
    /** 无视频时的占位渐变背景 */
    fallbackBg: string;
    /** 金色渐变色标 (SVG linearGradient 用) */
    goldGradient: GradientStop[];
    /** 标题卡 / 开场字符出现时的发光色 */
    glowColor: string;
    /** 统计数字背后的发光色 */
    statGlowColor: string;
    /** 金色描边色 (SVG stroke) */
    goldStroke: string;
  };

  /** 字幕条样式 */
  subtitle: {
    fontSize: number;
    /** 距底部像素 */
    bottom: number;
    color: string;
    strokeWidth: number;
    strokeColor: string;
    textShadow: string;
    padding: string;
    /** 背景条颜色 (含透明度) */
    bgColor: string;
  };

  /** 统计大数字样式 */
  statNumber: {
    fontSize: number;
    /** 扩散总幅度占画面宽度的比例 */
    spreadRatio: number;
    /** SVG 描边粗细 */
    strokeWidth: number;
    /** 各类字符宽度 = fontSize × ratio */
    charWidthRatios: {
      digit: number;
      comma: number;
      plusMinus: number;
      dot: number;
    };
    /** 各类字符的扩散权重 */
    charSpreadWeights: {
      digit: number;
      comma: number;
      plusMinus: number;
      dot: number;
    };
  };

  /** 水印样式 */
  watermark: {
    fontSize: number;
    top: number;
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
  };

  /** 排名数字过渡样式 */
  rankNumber: {
    svgSize: number;
    fontSize: number;
    lineSpacing: number;
    /** 线纹理期间的描边粗细 */
    lineStrokeWidth: number;
    /** 金属渐变期间的描边粗细 */
    goldStrokeWidth: number;
  };

  /** Ken Burns 摄像机运动 */
  kenBurns: {
    /** 缩放 [起始, 终止]，如 [1.0, 1.08] */
    zoomRange: [number, number];
    /** 水平平移 [起始, 终止]，如 [0, -15] */
    panXRange: [number, number];
  };

  /** 各场景的电影叠加参数 */
  cinematic: {
    intro: { grain: number; vignette: number };
    rankTransition: { grain: number; vignette: number };
    titleCard: { grain: number; vignette: number };
    gameplay: { grain: number; vignette: number };
  };

  /** 撕裂纸张效果 */
  tornPaper: {
    /** 撕裂高度占画面高度的比例 */
    tearHeightRatio: number;
    /** 撕裂边缘采样点数 (越大越细腻) */
    edgeSteps: number;
    /** 撕裂线锯齿幅度 (px) */
    edgeAmplitude: number;
    /** 裂缝内红色渐变色标 */
    crackGradientColors: string[];
    /** 纸张边缘色 (上方，从亮到暗) */
    edgeTopColors: string[];
    /** 纸张边缘色 (下方) */
    edgeBottomColors: string[];
    /** 投影模糊半径 */
    shadowBlur: number;
    /** 投影偏移 */
    shadowOffset: number;
    /** 投影不透明度 */
    shadowOpacity: number;
    /** 边缘线颜色 */
    edgeLineColor: string;
    /** 边缘线粗细 */
    edgeLineWidth: number;
  };

  /** 开场标题动画 */
  intro: {
    /** 字号 = min(width * ratio, max) */
    fontSizeRatio: number;
    fontSizeMax: number;
    /** 行间距 = height * ratio */
    lineGapRatio: number;
    /** 字符汇聚展开幅度 = width * ratio */
    spreadRatio: number;
    /** 随机打散种子 */
    shuffleSeed: number;
    /** 每个字符的延迟 = base + order * interval (帧) */
    delayBase: number;
    delayInterval: number;
    /** SVG 描边粗细 */
    strokeWidth: number;
    /** 投影偏移 */
    shadowOffsetX: number;
    shadowOffsetY: number;
  };

  /** 游戏标题卡动画 */
  titleCard: {
    /** 自适应字号阈值: [字符数上限, width倍率, 最大像素] */
    fontSizeBreakpoints: Array<[number, number, number]>;
    /** 字符延迟: base + order * interval (帧) */
    delayBase: number;
    delayInterval: number;
    /** measureText 后的额外间距 (fontSize 的倍数) */
    charPadding: number;
    /** SVG 描边粗细 */
    strokeWidth: number;
    /** 投影偏移 */
    shadowOffsetX: number;
    shadowOffsetY: number;
  };
}
