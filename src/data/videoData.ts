/**
 * ============================================================
 *  Top5 视频模板 - 数据配置文件
 *  修改此文件即可制作不同主题的 "Top 5 系列" 视频
 * ============================================================
 */

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

/**
 * 单个视频片段 —— 多个 VideoClip 会被依次拼接，
 * 字幕 / 统计数字浮在所有片段上方。
 */
export interface VideoClip {
  /** 视频文件路径，相对于 public/ 文件夹 */
  src: string;
  /**
   * 从原视频文件的第几秒开始播放（入点裁剪）
   * 不填则从头开始
   */
  startFrom?: number;
  /** 该片段在最终视频中持续多少秒 */
  durationSec: number;
}

export interface GameItem {
  rank: number;
  /** 英文/主标题名 (大字显示) */
  titleEn: string;
  /** 中文名 (可选, 显示在游戏名卡片上) */
  titleZh?: string;
  /** 游戏介绍字幕 —— 浮在视频上方 */
  subtitles: SubtitleLine[];
  /** 数据统计展示 —— 浮在视频上方 */
  stats?: StatDisplay[];

  /**
   * ★ 多视频片段列表（推荐方式）
   * 依次拼接播放，文字叠加在所有片段上方。
   * 各 clip.durationSec 之和应等于 timing.gameplayDurations[i]
   */
  clips?: VideoClip[];

  /**
   * 单视频兼容字段（旧方式）
   * 若同时提供了 clips，优先使用 clips。
   */
  videoSrc?: string;

  /** 背景色 (无视频/片段时使用的占位背景) */
  bgColor?: string;
}

export interface Top5VideoData {
  /** 视频标题 (开场大字) - 第一行 */
  titleLine1: string;
  /** 视频标题 - 第二行 */
  titleLine2: string;
  /** 水印/频道名 */
  watermark: string;
  /** FPS */
  fps: number;
  /** 视频宽度 */
  width: number;
  /** 视频高度 */
  height: number;
  /** 五个游戏项 (从第5名到第1名排列) */
  games: GameItem[];
  /**
   * 时间配置 (单位: 秒)
   */
  timing: {
    /** 开场标题持续时间 */
    introDuration: number;
    /** 排名数字过渡画面持续时间 */
    rankTransitionDuration: number;
    /** 游戏名称展示持续时间 */
    titleCardDuration: number;
    /**
     * 每个游戏的 gameplay 段总时长（秒）
     * 应等于对应 clips[].durationSec 之和
     */
    gameplayDurations: number[];
  };
}

// ====== 默认数据: 全球人气前五游戏（含多片段示例） ======
export const defaultVideoData: Top5VideoData = {
  titleLine1: "全球人气",
  titleLine2: "前五游戏",
  watermark: "Sodabobo",
  fps: 30,
  width: 852,
  height: 480,
  games: [
    {
      rank: 5,
      titleEn: "PUBG Mobile",
      titleZh: "绝地求生手游版",
      bgColor: "#3a5a40",
      // ★ 3 段 PUBG 素材拼接，总计 13 秒
      clips: [
      ],
      subtitles: [
        { text: "绝地求生手游版",             startSec: 1,   durationSec: 2.5 },
        { text: "战术竞技与团队合作的完美融合", startSec: 4,   durationSec: 3   },
        { text: "大吉大利，今晚吃鸡！",         startSec: 7,   durationSec: 2.5 },
        { text: "大逃杀类型的经典神作",          startSec: 10,  durationSec: 2.5 },
      ],
      stats: [
        { value: "146,000,000+", startSec: 7, durationSec: 2.5 },
      ],
    },
    {
      rank: 4,
      titleEn: "Subway Surfers",
      titleZh: "地铁跑酷",
      bgColor: "#f4a236",
      clips: [
      ],
      subtitles: [
        { text: "地铁跑酷",            startSec: 1,  durationSec: 2   },
        { text: "简单上手的跑酷玩法",   startSec: 4,  durationSec: 2.5 },
        { text: "全球下载量超过40亿次",  startSec: 7,  durationSec: 2.5 },
        { text: "定义跑酷标杆",          startSec: 10, durationSec: 2   },
      ],
      stats: [
        { value: "4,000,000,000+", startSec: 7, durationSec: 2.5 },
      ],
    },
    {
      rank: 3,
      titleEn: "Minecraft",
      titleZh: "我的世界",
      bgColor: "#5b8731",
      clips: [
      ],
      subtitles: [
        { text: "我的世界",           startSec: 1,  durationSec: 2   },
        { text: "无限创造的沙盒世界",  startSec: 4,  durationSec: 2.5 },
        { text: "销量超过3亿份",       startSec: 7,  durationSec: 2.5 },
        { text: "永不过时的经典之作",  startSec: 10, durationSec: 2   },
      ],
      stats: [
        { value: "300,000,000+", startSec: 7, durationSec: 2.5 },
      ],
    },
    {
      rank: 2,
      titleEn: "Candy Crush Saga",
      titleZh: "糖果传奇",
      bgColor: "#1a8fbf",
      clips: [
      ],
      subtitles: [
        { text: "糖果传奇",           startSec: 1,  durationSec: 2   },
        { text: "三消游戏的王者",      startSec: 4,  durationSec: 2.5 },
        { text: "日活跃玩家超过2亿",   startSec: 7,  durationSec: 2.5 },
        { text: "休闲游戏的巅峰代表",  startSec: 10, durationSec: 2   },
      ],
      stats: [
        { value: "200,000,000+", startSec: 7, durationSec: 2.5 },
      ],
    },
    {
      rank: 1,
      titleEn: "王者荣耀",
      titleZh: "Honor of Kings",
      bgColor: "#c4922a",
      clips: [
      ],
      subtitles: [
        { text: "王者荣耀",                startSec: 1,  durationSec: 2   },
        { text: "国民级MOBA手游",           startSec: 4,  durationSec: 2.5 },
        { text: "日活跃用户超过1亿",        startSec: 7,  durationSec: 2.5 },
        { text: "当之无愧的全球第一手游",   startSec: 10, durationSec: 3   },
      ],
      stats: [
        { value: "100,000,000+", startSec: 7, durationSec: 2.5 },
      ],
    },
  ],
  timing: {
    introDuration: 2,
    rankTransitionDuration: 2,
    titleCardDuration: 1.5,
    // 每项 = 对应 clips[].durationSec 之和
    gameplayDurations: [13, 12, 12, 12, 14],
  },
};

/**
 * 计算视频总帧数
 */
export function calculateTotalFrames(data: Top5VideoData): number {
  const { timing, fps } = data;
  let totalSec = timing.introDuration;
  for (let i = 0; i < data.games.length; i++) {
    totalSec += timing.rankTransitionDuration;
    totalSec += timing.titleCardDuration;
    totalSec += timing.gameplayDurations[i];
  }
  totalSec += 1;
  return Math.ceil(totalSec * fps);
}

/**
 * 计算每个片段的起始帧
 */
export function calculateSegments(data: Top5VideoData) {
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

  const endingFrames = Math.round(1 * fps);
  segments.push({ type: "ending", startFrame: currentFrame, durationFrames: endingFrames });

  return segments;
}
