import React, { useMemo, useRef, useLayoutEffect } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { TornPaperEffect } from "./TornPaperEffect";
import { Watermark } from "./Watermark";
import { CinematicOverlay } from "./CinematicOverlay";
import { styleConfig } from "../config";

const prand = (s: number) => {
  const x = Math.sin(s * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const INTRO_SS = 2;

/**
 * 开场标题画面 — Canvas 2D 渲染 + 2x 超采样
 *
 * 样式参数来源: style.config.yaml → intro, fonts, colors, cinematic.intro
 */
export const IntroScene: React.FC<{
  titleLine1: string;
  titleLine2: string;
  watermark: string;
  introFontSize: number;
  introLineGap: number;
  introCharSpacing: number;
  introStrokeWidth: number;
  introCharHeight: number;
  watermarkFontSize?: number;
}> = ({
  titleLine1,
  titleLine2,
  watermark,
  introFontSize,
  introLineGap,
  introCharSpacing,
  introStrokeWidth,
  introCharHeight,
  watermarkFontSize,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const FONT_TITLE = styleConfig.fonts.title;
  const GOLD_STOPS = styleConfig.colors.goldGradient;
  const glowColor = styleConfig.colors.glowColor;
  const {
    spreadRatio,
    shuffleSeed,
    delayBase,
    delayInterval,
    shadowOffsetX,
    shadowOffsetY,
  } = styleConfig.intro;
  const cine = styleConfig.cinematic.intro;

  const chars = useMemo(() => {
    const line1 = titleLine1.split("");
    const line2 = titleLine2.split("");
    const all: Array<{
      char: string;
      line: number;
      indexInLine: number;
      lineLength: number;
    }> = [];
    line1.forEach((c, i) =>
      all.push({ char: c, line: 0, indexInLine: i, lineLength: line1.length }),
    );
    line2.forEach((c, i) =>
      all.push({ char: c, line: 1, indexInLine: i, lineLength: line2.length }),
    );
    return all;
  }, [titleLine1, titleLine2]);

  const delays = useMemo(() => {
    const n = chars.length;
    const order = chars.map((_, i) => i);
    const rand = (s: number) => {
      const x = Math.sin(s * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand(i + shuffleSeed) * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const delayMap = new Array(n).fill(0);
    order.forEach((charIdx, orderPos) => {
      delayMap[charIdx] = delayBase + orderPos * delayInterval;
    });
    return delayMap;
  }, [chars, shuffleSeed, delayBase, delayInterval]);

  const fontSize = introFontSize;
  const lineGap = introLineGap;

  const convergeProgress = interpolate(
    frame,
    [0, durationInFrames * 0.85],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  const maxSpread = width * spreadRatio;

  const getCharW = (char: string) => {
    const isCJK = char.charCodeAt(0) > 0x2000;
    return fontSize * (isCJK ? introCharSpacing : introCharSpacing * 0.68);
  };

  // ── Canvas 逐帧绘制 ──
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const S = INTRO_SS;
    const W = width * S;
    const H = height * S;
    ctx.clearRect(0, 0, W, H);

    const fSize = fontSize * S;
    const font = `900 ${fSize}px ${FONT_TITLE}`;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const charH = fontSize * introCharHeight;
    const totalTextH = charH * 2 + lineGap;
    const startY = (height - totalTextH) / 2;
    const line1Base = startY + fontSize;
    const line2Base = startY + charH + lineGap + fontSize;

    const line0 = chars.filter((c) => c.line === 0);
    const line1 = chars.filter((c) => c.line === 1);

    const drawLine = (
      lineChars: typeof chars,
      globalOffset: number,
      baseY: number,
    ) => {
      const totalW = lineChars.reduce((s, c) => s + getCharW(c.char), 0);
      let curX = (width - totalW) / 2;

      for (let li = 0; li < lineChars.length; li++) {
        const ci = lineChars[li];
        const gi = globalOffset + li;
        const cw = getCharW(ci.char);
        const charCenter = curX + cw / 2;
        curX += cw;

        const delay = delays[gi];

        const opacity = interpolate(
          frame,
          [
            delay,
            delay + 0.3,
            delay + 0.5,
            delay + 0.8,
            delay + 1.0,
            delay + 1.3,
            delay + 1.8,
            delay + 2.5,
            delay + 3.5,
            delay + 5,
            delay + 7,
          ],
          [0, 0.85, 0, 0.7, 0, 0.9, 0.3, 0.85, 0.95, 0.98, 1.0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        if (opacity <= 0) continue;

        const flash = interpolate(
          frame,
          [delay, delay + 0.3, delay + 0.8],
          [0, 0.7, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const gSeed = prand(gi * 31 + Math.floor(frame * 0.7));
        const isG = frame >= delay && frame < delay + 4;
        const gX = isG ? (gSeed - 0.5) * 14 : 0;

        const cIdx = (ci.lineLength - 1) / 2;
        const spX =
          (ci.indexInLine - cIdx) * maxSpread * (1 - convergeProgress);

        const fx = (charCenter + spX + gX) * S;
        const fy = baseY * S;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = font;

        // 投影
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText(ci.char, fx + shadowOffsetX * S, fy + shadowOffsetY * S);

        // 出现瞬间的金色闪光
        if (flash > 0.01) {
          ctx.save();
          ctx.globalAlpha = opacity * flash * 0.6;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = flash * 22 * S;
          ctx.fillStyle = glowColor;
          ctx.fillText(ci.char, fx, fy);
          ctx.restore();
          ctx.globalAlpha = opacity;
        }

        // 金色渐变
        const grad = ctx.createLinearGradient(
          0,
          fy - fSize * 0.85,
          0,
          fy + fSize * 0.15,
        );
        for (const stop of GOLD_STOPS) {
          grad.addColorStop(parseFloat(stop.offset) / 100, stop.color);
        }

        // 描边（paintOrder: stroke 等效 — 先描边再填充）
        ctx.lineWidth = introStrokeWidth * S;
        ctx.lineJoin = "round";
        ctx.strokeStyle = grad;
        ctx.strokeText(ci.char, fx, fy);

        // 金色填充
        ctx.fillStyle = grad;
        ctx.fillText(ci.char, fx, fy);

        ctx.restore();
      }
    };

    drawLine(line0, 0, line1Base);
    drawLine(line1, line0.length, line2Base);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: styleConfig.colors.globalBg }}>
      <TornPaperEffect
        width={width}
        height={height}
        progress={1}
        seed={1.5}
      />

      <div style={{ position: "absolute", inset: 0, zIndex: 50 }}>
        <canvas
          ref={canvasRef}
          width={width * INTRO_SS}
          height={height * INTRO_SS}
          style={{ width, height }}
        />
      </div>

      <CinematicOverlay
        width={width}
        height={height}
        grainIntensity={cine.grain}
        vignetteIntensity={cine.vignette}
      />
      <Watermark text={watermark} width={width} fontSizeOverride={watermarkFontSize} />
    </AbsoluteFill>
  );
};
