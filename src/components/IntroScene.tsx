import React, { useMemo, useRef, useLayoutEffect } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
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
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const FONT_TITLE = styleConfig.fonts.title;
  const GOLD_STOPS = styleConfig.colors.goldGradient;
  const glowColor = styleConfig.colors.glowColor;
  const {
    shuffleSeed,
    delayBase,
    delayInterval,
    spreadRatio,
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
    const scored = chars.map((_char, i) => {
      return {
        charIdx: i,
        score: prand(i * 17 + shuffleSeed),
      };
    });
    scored.sort((a, b) => a.score - b.score);

    const delayMap = new Array(chars.length).fill(0);
    scored.forEach(({ charIdx }, orderPos) => {
      delayMap[charIdx] = delayBase + orderPos * delayInterval;
    });
    return delayMap;
  }, [chars, shuffleSeed, delayBase, delayInterval]);

  const fontSize = introFontSize;
  const lineGap = introLineGap;

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
    const startY = (height - totalTextH) / 2 - 15;
    const line1Base = startY + fontSize;
    const line2Base = startY + charH + lineGap + fontSize;

    const line0 = chars.filter((c) => c.line === 0);
    const line1 = chars.filter((c) => c.line === 1);
    const spacingExpand = interpolate(
      frame,
      [0, 4, 9, 16, 24, 30],
      [1 + spreadRatio * 1.25, 1 + spreadRatio, 1 + spreadRatio * 0.6, 1 + spreadRatio * 0.26, 1.02, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    const drawLine = (
      lineChars: typeof chars,
      globalOffset: number,
      baseY: number,
    ) => {
      const totalW = lineChars.reduce((s, c) => s + getCharW(c.char), 0);
      const lineCenter = width / 2;
      let curX = lineCenter - totalW / 2;

      for (let li = 0; li < lineChars.length; li++) {
        const ci = lineChars[li];
        const gi = globalOffset + li;
        const cw = getCharW(ci.char);
        const finalCenter = curX + cw / 2;
        curX += cw;

        const delay = delays[gi];

        const revealFrame = frame - delay;
        const baseOpacity = interpolate(
          revealFrame,
          [0, 0.55, 1.1, 1.7, 2.4, 3.1, 4.1, 5.1, 6.4, 8.2, 10.2],
          [0, 1, 0.08, 0.9, 0.14, 1, 0.22, 0.94, 0.5, 1, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const strobe =
          revealFrame < 6.8
            ? (prand(gi * 53 + Math.floor(Math.max(revealFrame, 0) * 2.2) + shuffleSeed) > 0.46 ? 1 : 0.22)
            : 1;
        const opacity = baseOpacity * strobe;
        if (opacity <= 0.01) continue;

        const flash = interpolate(
          revealFrame,
          [0, 0.45, 1.1, 1.9, 3.2, 4.8],
          [0, 1, 0.35, 0.18, 0.08, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const startCenter = lineCenter + (finalCenter - lineCenter) * spacingExpand;
        const fx = startCenter * S;
        const fy = baseY * S;

        const grad = ctx.createLinearGradient(
          0,
          fy - fSize * 0.85,
          0,
          fy + fSize * 0.15,
        );
        for (const stop of GOLD_STOPS) {
          grad.addColorStop(parseFloat(stop.offset) / 100, stop.color);
        }

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = font;

        // 投影
        ctx.fillStyle = "rgba(0,0,0,0.7)";
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
    <AbsoluteFill>
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
        vignetteIntensity={cine.vignette}
      />
      <Watermark text={watermark} width={width} fontSizeOverride={watermarkFontSize} />
    </AbsoluteFill>
  );
};
