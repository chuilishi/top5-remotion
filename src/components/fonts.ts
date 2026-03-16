/**
 * 字体 & 渐变色 — 从 style.config.yaml 读取
 *
 * 保留此文件作为快捷导出，组件可继续 import { FONT_TITLE } from "./fonts"
 * 也可直接 import { styleConfig } from "../config"
 */

import { styleConfig } from "../config";

/** 大标题 / 排名数字 — 最粗 */
export const FONT_TITLE = styleConfig.fonts.title;

/** 字幕 */
export const FONT_SUBTITLE = styleConfig.fonts.subtitle;

/** 水印 */
export const FONT_WATERMARK = styleConfig.fonts.watermark;

/** 统计数字 — 等宽感更好 */
export const FONT_STAT = styleConfig.fonts.stat;

/** 金色渐变色值 (SVG用) */
export const GOLD_GRADIENT_STOPS = styleConfig.colors.goldGradient;
