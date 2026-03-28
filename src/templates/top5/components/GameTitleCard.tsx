import React, { useMemo, useRef, useLayoutEffect } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  OffthreadVideo,
} from "remotion";
import { Watermark } from "./Watermark";
import { CinematicOverlay } from "./CinematicOverlay";
import { styleConfig } from "../config";
import type { GameItem } from "../config";

const prand = (s: number) => {
  const x = Math.sin(s * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const GTC_SS = 2;

/**
 * 游戏标题卡 — Canvas 2D 渲染 + 2x 超采样
 *
 * 样式参数来源: style.config.yaml → titleCard, fonts, colors, cinematic.titleCard
 */
export const GameTitleCard: React.FC<{
  game: GameItem;
  watermark: string;
  overlay?: boolean;
  skewX?: number;
  scaleX?: number;
  translateX?: number;
  fontSizeMultiplier?: number;
  charPaddingOverride?: number;
  shadowOffsetXOverride?: number;
  shadowOffsetYOverride?: number;
  glowMultiplier?: number;
  redGlowRadius?: number;
  watermarkFontSize?: number;
}> = ({
  game, watermark,
  overlay = false,
  skewX = -8, scaleX = 0.85, translateX = 2,
  fontSizeMultiplier = 1.0,
  charPaddingOverride,
  shadowOffsetXOverride,
  shadowOffsetYOverride,
  glowMultiplier = 1.0,
  redGlowRadius = 22,
  watermarkFontSize,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const FONT_TITLE = styleConfig.fonts.title;
  const GOLD_STOPS = styleConfig.colors.goldGradient;
  const glowColor = styleConfig.colors.glowColor;
  const {
    fontSizeBreakpoints,
    delayBase: tcDelayBase,
    delayInterval: tcDelayInterval,
    charPadding: defaultCharPadding,
    shadowOffsetX: defaultShadowOffsetX,
    shadowOffsetY: defaultShadowOffsetY,
  } = styleConfig.titleCard;
  const charPadding = charPaddingOverride ?? defaultCharPadding;
  const shadowOffsetX = shadowOffsetXOverride ?? defaultShadowOffsetX;
  const shadowOffsetY = shadowOffsetYOverride ?? defaultShadowOffsetY;
  const cine = styleConfig.cinematic.titleCard;

  const titleText = game.titleEn;
  const chars = titleText.split("");

  const delays = useMemo(() => {
    const n = chars.length;
    const order = chars.map((_, i) => i);
    const seed = game.rank * 17 + 31;
    const rand = (s: number) => {
      const x = Math.sin(s * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand(i + seed) * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const delayMap = new Array(n).fill(0);
    const interval =
      tcDelayInterval < 0 ? Math.max(0.8, 12 / n) : tcDelayInterval;
    order.forEach((charIdx, orderPos) => {
      delayMap[charIdx] = tcDelayBase + orderPos * interval;
    });
    return delayMap;
  }, [chars, game.rank, tcDelayBase, tcDelayInterval]);

  const bgOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(
    frame,
    [5, 10, 18, 45],
    [0, 0.65 * glowMultiplier, 0.5 * glowMultiplier, 0.35 * glowMultiplier],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const getAdaptiveFontSize = () => {
    const len = titleText.length;
    for (const [maxLen, ratio, maxPx] of fontSizeBreakpoints) {
      if (len <= maxLen) return Math.min(width * ratio, maxPx);
    }
    const last = fontSizeBreakpoints[fontSizeBreakpoints.length - 1];
    return Math.min(width * last[1], last[2]);
  };
  const fontSize = getAdaptiveFontSize() * fontSizeMultiplier;

  const charWidths = useMemo(() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.font = `900 ${fontSize}px ${FONT_TITLE}`;
    const widths: Record<string, number> = {};
    const pad = fontSize * charPadding;
    for (const ch of chars) {
      if (!(ch in widths)) {
        widths[ch] = ctx.measureText(ch).width + pad;
      }
    }
    return widths;
  }, [chars, fontSize, FONT_TITLE, charPadding]);

  const spaceWidth = useMemo(() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) return fontSize * 0.3;
    ctx.font = `900 ${fontSize}px ${FONT_TITLE}`;
    return ctx.measureText(" ").width;
  }, [fontSize, FONT_TITLE]);

  const getCharW = (ch: string) => {
    if (ch === " ") return spaceWidth;
    const isCJK = ch.charCodeAt(0) > 0x2000;
    return charWidths?.[ch] ?? fontSize * (isCJK ? 1.15 : 0.65);
  };

  // ── Canvas 逐帧绘制 ──
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const S = GTC_SS;
    const W = width * S;
    const H = height * S;
    ctx.clearRect(0, 0, W, H);

    const fSize = fontSize * S;
    const font = `900 ${fSize}px ${FONT_TITLE}`;

    // 按词分行（word-level wrap）
    const maxLineW = width * 0.92;
    type CharEntry = { char: string; gi: number; w: number };
    const lines: CharEntry[][] = [[]];
    let lineW = 0;
    let wordBuf: CharEntry[] = [];
    let wordW = 0;

    const flushWord = () => {
      if (wordBuf.length === 0) return;
      if (lineW + wordW > maxLineW && lineW > 0) {
        lines.push([]);
        lineW = 0;
      }
      lines[lines.length - 1].push(...wordBuf);
      lineW += wordW;
      wordBuf = [];
      wordW = 0;
    };

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const w = getCharW(ch);
      if (ch === " ") {
        flushWord();
        lines[lines.length - 1].push({ char: ch, gi: i, w });
        lineW += w;
      } else {
        wordBuf.push({ char: ch, gi: i, w });
        wordW += w;
      }
    }
    flushWord();

    const lineH = fontSize * 1.35;
    const totalH = lines.length * lineH;
    const textStartY = (height - totalH) / 2;

    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lw = line.reduce((s, c) => s + c.w, 0);
      let cx = (width - lw) / 2;
      const baseY = textStartY + li * lineH + fontSize;

      for (const { char, gi, w } of line) {
        if (char === " ") {
          cx += w;
          continue;
        }

        const delay = delays[gi];
        const opacity = interpolate(
          frame,
          [
            delay,
            delay + 0.5,
            delay + 1.0,
            delay + 1.8,
            delay + 3.0,
            delay + 4.5,
            delay + 6,
          ],
          [0, 0.7, 0.3, 0.8, 0.6, 0.9, 1.0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        if (opacity <= 0) {
          cx += w;
          continue;
        }

        const flash = interpolate(
          frame,
          [delay, delay + 0.3, delay + 0.8],
          [0, 0.3, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const isG = frame >= delay && frame < delay + 2;
        const gSeed = prand(gi * 29 + Math.floor(frame * 0.6));
        const gX = isG ? (gSeed - 0.5) * 5 : 0;

        const dx = (cx + w / 2 + gX) * S;
        const dy = baseY * S;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = font;

        // 投影（模糊）
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 9 * S;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillText(char, dx + shadowOffsetX * S, dy + shadowOffsetY * S);
        ctx.restore();
        ctx.globalAlpha = opacity;

        // 红色字符光晕
        ctx.save();
        ctx.globalAlpha = opacity * 0.8;
        ctx.shadowColor = "#ff3300";
        ctx.shadowBlur = redGlowRadius * S;
        ctx.fillStyle = "#ff3300";
        ctx.fillText(char, dx, dy);
        ctx.restore();
        ctx.globalAlpha = opacity;

        // 金色渐变
        const grad = ctx.createLinearGradient(
          0,
          dy - fSize * 0.85,
          0,
          dy + fSize * 0.15,
        );
        for (const stop of GOLD_STOPS) {
          grad.addColorStop(parseFloat(stop.offset) / 100, stop.color);
        }

        // 金色填充 + 闪光发光
        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = (5 + flash * 14) * S;
        ctx.fillStyle = grad;
        ctx.fillText(char, dx, dy);
        ctx.restore();

        ctx.restore();
        cx += w;
      }
    }
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {!overlay && (
        <>
          {/* 背景 */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              opacity: bgOpacity,
            }}
          >
            {game.clips && game.clips.length > 0 ? (
              <OffthreadVideo
                src={staticFile(game.clips[0].src)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : game.videoSrc ? (
              <OffthreadVideo
                src={staticFile(game.videoSrc)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `
                    radial-gradient(ellipse at 30% 40%, #333d, transparent 60%),
                    radial-gradient(ellipse at 70% 60%, #33399, transparent 50%),
                    ${styleConfig.colors.fallbackBg}
                  `,
                }}
              />
            )}
          </div>

          {/* 红色发光 */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background: `radial-gradient(ellipse at center, rgba(255,60,10,${glowOpacity}) 0%, rgba(200,30,0,${glowOpacity * 0.3}) 35%, transparent 60%)`,
              zIndex: 5,
            }}
          />
        </>
      )}

      {/* 标题 — Canvas 渲染 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: overlay ? 60 : 10,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width * GTC_SS}
          height={height * GTC_SS}
          style={{
            width,
            height,
            transform: `skewX(${skewX}deg) scaleX(${scaleX}) translateX(${translateX}%)`,
          }}
        />
      </div>

      {!overlay && (
        <>
          <CinematicOverlay
            width={width}
            height={height}
            vignetteIntensity={cine.vignette}
            zIndex={80}
          />
          <Watermark text={watermark} width={width} fontSizeOverride={watermarkFontSize} />
        </>
      )}
    </AbsoluteFill>
  );
};
