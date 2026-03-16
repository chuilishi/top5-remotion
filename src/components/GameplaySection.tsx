import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  OffthreadVideo,
  staticFile,
  Sequence,
} from "remotion";
import { Watermark } from "./Watermark";
import { CinematicOverlay } from "./CinematicOverlay";
import { styleConfig } from "../config";
import type { GameItem } from "../config";

// ─────────────────────────────────────────────
// 字幕 — Canvas 2D 渲染 + 2x 超采样
// 走 OS 原生文字光栅化器（DirectWrite / Core Text），
// 比 SVG <text> 和 -webkit-text-stroke 质量高一个档次
//
// 样式参数来源: style.config.yaml → subtitle, fonts.subtitle
// ─────────────────────────────────────────────
const SUBTITLE_SS = 2; // 超采样倍率

const Subtitle: React.FC<{
  text: string;
  width: number;
  fontSizeOverride?: number;
  bottomOverride?: number;
  strokeWidthOverride?: number;
}> = ({ text, width, fontSizeOverride, bottomOverride, strokeWidthOverride }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const sub = styleConfig.subtitle;
  const fontFamily = styleConfig.fonts.subtitle;
  const fontSize = fontSizeOverride ?? (sub.fontSize as number);
  const subBottom = bottomOverride ?? sub.bottom;
  const subStrokeWidth = strokeWidthOverride ?? sub.strokeWidth;
  const canvasH = fontSize * 2.4;

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const S = SUBTITLE_SS;
    const W = width * S;
    const H = canvasH * S;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    ctx.font = `900 ${fontSize * S}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Pass 1: 宽域柔和阴影（环境光遮蔽感）
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 36 * S;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = (subStrokeWidth + 6) * S;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.01)";
    ctx.strokeText(text, cx, cy);
    ctx.restore();

    // Pass 2: 方向性硬阴影 + 描边（描边本身投射阴影）
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 14 * S;
    ctx.shadowOffsetX = 2 * S;
    ctx.shadowOffsetY = 5 * S;
    ctx.lineWidth = subStrokeWidth * S;
    ctx.lineJoin = "round";
    ctx.strokeStyle = sub.strokeColor;
    ctx.strokeText(text, cx, cy);
    ctx.restore();

    // Pass 3: 干净描边覆盖（无阴影，确保边缘锐利）
    ctx.lineWidth = subStrokeWidth * S;
    ctx.lineJoin = "round";
    ctx.strokeStyle = sub.strokeColor;
    ctx.strokeText(text, cx, cy);

    // Pass 4: 白色填充
    ctx.fillStyle = sub.color;
    ctx.fillText(text, cx, cy);
  }, [text, fontSize, fontFamily, width, canvasH, sub, subStrokeWidth]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: subBottom,
        left: 0,
        width,
        display: "flex",
        justifyContent: "center",
        zIndex: 60,
      }}
    >
      <canvas
        ref={canvasRef}
        width={width * SUBTITLE_SS}
        height={canvasH * SUBTITLE_SS}
        style={{ width, height: canvasH }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────
// 统计数字 — SVG渲染 + 修正kerning + 改善闪烁
//
// 样式参数来源: style.config.yaml → statNumber, fonts.stat, colors
// ─────────────────────────────────────────────

// 确定性伪随机
const statRand = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const StatNumber: React.FC<{
  value: string;
  width: number;
  height: number;
  fontSizeOverride?: number;
  skewXOverride?: number;
  scaleXOverride?: number;
  spreadRatioOverride?: number;
}> = ({ value, width, height, fontSizeOverride, skewXOverride = -6, scaleXOverride = 0.88, spreadRatioOverride }) => {
  const frame = useCurrentFrame();
  const chars = value.split("");

  const FONT_STAT = styleConfig.fonts.stat;
  const GOLD_GRADIENT_STOPS = styleConfig.colors.goldGradient;
  const goldStroke = styleConfig.colors.goldStroke;
  const {
    fontSize: defaultStatFontSize,
    spreadRatio: defaultSpreadRatio,
    strokeWidth: statStrokeWidth,
    charWidthRatios,
    charSpreadWeights,
  } = styleConfig.statNumber;
  const statFontSize = fontSizeOverride ?? defaultStatFontSize;
  const spreadRatio = spreadRatioOverride ?? defaultSpreadRatio;
  const statGlowColor = styleConfig.colors.statGlowColor;

  // ── 动画曲线：spread 从0→1.44→1.0 ──
  const expandEnd = 9;
  const settleEnd = 27;

  const expandPhase = interpolate(
    frame,
    [0, 1, 2, 3, 4, 6, expandEnd],
    [0, 0, 0.15, 0.24, 0.68, 1.26, 1.44],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const contractPhase = interpolate(
    frame,
    [expandEnd, settleEnd],
    [1.44, 1.0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    }
  );

  const spread = frame <= expandEnd ? expandPhase : contractPhase;

  // ── kerning 修正：不同字符类型用不同扩散权重 ──
  const getCharSpreadWeight = (char: string) => {
    if (char === ",") return charSpreadWeights.comma;
    if (char === "+" || char === "-") return charSpreadWeights.plusMinus;
    if (char === ".") return charSpreadWeights.dot;
    return charSpreadWeights.digit;
  };

  const baseTotalSpread = width * spreadRatio;

  // 出现
  const opacity = interpolate(frame, [1, 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glitchFlickerEnd = 14;

  // 红色发光 (降低强度避免染色数字)
  const glowIntensity = interpolate(
    frame,
    [0, 10, 22, settleEnd],
    [0, 0.05, 0.15, 0.25],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // 计算每个字符的基础宽度（逗号/加号比数字窄）
  const getCharWidth = (char: string) => {
    if (char === ",") return statFontSize * charWidthRatios.comma;
    if (char === "+" || char === "-") return statFontSize * charWidthRatios.plusMinus;
    if (char === ".") return statFontSize * charWidthRatios.dot;
    return statFontSize * charWidthRatios.digit;
  };

  // 计算总宽度用于居中
  const totalBaseWidth = chars.reduce((sum, c) => sum + getCharWidth(c), 0);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 55,
        opacity,
      }}
    >
      {/* 红色发光背景 */}
      <div
        style={{
          position: "absolute",
          width: "70%",
          height: "30%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, ${statGlowColor.replace("rgb", "rgba").replace(")", `,${glowIntensity})`)} 0%, ${statGlowColor.replace("rgb", "rgba").replace(")", `,${glowIntensity * 0.4})`)} 40%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* SVG 统计数字 */}
      <svg
        width={width * 0.9}
        height={statFontSize * 2}
        viewBox={`0 0 ${width * 0.9} ${statFontSize * 2}`}
        style={{ overflow: "visible", transform: `skewX(${skewXOverride}deg) scaleX(${scaleXOverride})` }}
      >
        <defs>
          <linearGradient id="stat-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            {GOLD_GRADIENT_STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <filter
            id="stat-shadow"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur" />
            <feOffset dy="7" />
            <feFlood floodColor="#000" floodOpacity="0.8" />
            <feComposite in2="blur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="stat-char-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="glow" />
          </filter>
        </defs>

        {(() => {
          const centerX = (width * 0.9) / 2;
          const centerY = statFontSize * 1.2;

          // 计算每个字符的位置
          let currentX = centerX - totalBaseWidth / 2;

          return chars.map((char, i) => {
            const cw = getCharWidth(char);
            const charCenterX = currentX + cw / 2;
            currentX += cw;

            // 展开偏移
            const centerOffset =
              (charCenterX - centerX) / (totalBaseWidth / 2 || 1);
            const spreadWeight = getCharSpreadWeight(char);
            const extraOffset =
              centerOffset * baseTotalSpread * (spread - 1.0) * spreadWeight;

            // 故障闪烁
            const seed = i * 13 + 7;
            const flickerDelay = 2 + statRand(seed) * 3;
            const r1 = statRand(seed + 1);
            const r2 = statRand(seed + 2);
            const r3 = statRand(seed + 3);
            const r4 = statRand(seed + 4);

            const charGlitch = interpolate(
              frame,
              [
                flickerDelay,
                flickerDelay + 0.3,
                flickerDelay + 0.6,
                flickerDelay + 1.0,
                flickerDelay + 1.5,
                flickerDelay + 2.5,
                flickerDelay + 4,
                flickerDelay + 6,
                glitchFlickerEnd,
              ],
              [
                0.2 + r1 * 0.3,
                0.85 + r2 * 0.15,
                0.1 + r3 * 0.2,
                0.9,
                0.4 + r4 * 0.2,
                0.92,
                0.96,
                0.98,
                1.0,
              ],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            // 金色闪光
            const flashStart = flickerDelay;
            const charFlash = interpolate(
              frame,
              [flashStart, flashStart + 0.3, flashStart + 1.0],
              [0, 0.5, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const posX = charCenterX + extraOffset;

            return (
              <g key={i} opacity={charGlitch}>
                {/* 字符发光层 */}
                <text
                  x={posX}
                  y={centerY}
                  textAnchor="middle"
                  fontFamily={FONT_STAT}
                  fontWeight={900}
                  fontSize={statFontSize}
                  fill="url(#stat-gold)"
                  opacity={0.6}
                  filter="url(#stat-char-glow)"
                >
                  {char}
                </text>
                {/* 投影层 (无描边) */}
                <text
                  x={posX}
                  y={centerY}
                  textAnchor="middle"
                  fontFamily={FONT_STAT}
                  fontWeight={900}
                  fontSize={statFontSize}
                  fill="url(#stat-gold)"
                  filter="url(#stat-shadow)"
                >
                  {char}
                </text>
                {/* 金色填充 */}
                <text
                  x={posX}
                  y={centerY}
                  textAnchor="middle"
                  fontFamily={FONT_STAT}
                  fontWeight={900}
                  fontSize={statFontSize}
                  fill="url(#stat-gold)"
                >
                  {char}
                </text>
                {/* 闪光高亮 */}
                {charFlash > 0.01 && (
                  <text
                    x={posX}
                    y={centerY}
                    textAnchor="middle"
                    fontFamily={FONT_STAT}
                    fontWeight={900}
                    fontSize={statFontSize}
                    fill={`rgba(255,240,180,${charFlash * 0.3})`}
                  >
                    {char}
                  </text>
                )}
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────
// 占位背景
//
// 样式参数来源: style.config.yaml → colors.fallbackBg, fonts.stat
// ─────────────────────────────────────────────
const FallbackBg: React.FC<{ game: GameItem }> = ({ game }) => (
  <AbsoluteFill>
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `
          radial-gradient(ellipse at 30% 40%, ${game.bgColor ?? "#333"}dd, transparent 60%),
          radial-gradient(ellipse at 70% 60%, ${game.bgColor ?? "#333"}99, transparent 50%),
          ${styleConfig.colors.fallbackBg}
        `,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: styleConfig.fonts.stat,
          fontSize: 81,
          color: "rgba(255,255,255,0.08)",
          fontWeight: 900,
          letterSpacing: 18,
          textTransform: "uppercase",
        }}
      >
        {game.titleEn}
      </span>
    </div>
  </AbsoluteFill>
);

// ─────────────────────────────────────────────
// Ken Burns
//
// 样式参数来源: style.config.yaml → kenBurns
// ─────────────────────────────────────────────
const ClipWithKenBurns: React.FC<{
  src: string;
  startFrom: number;
  globalStartFrame: number;
  totalFrames: number;
}> = ({ src, startFrom, globalStartFrame, totalFrames }) => {
  const localFrame = useCurrentFrame();
  const globalFrame = localFrame + globalStartFrame;
  const { zoomRange, panXRange } = styleConfig.kenBurns;

  const zoomScale = interpolate(globalFrame, [0, totalFrames], zoomRange, {
    extrapolateRight: "clamp",
  });
  const panX = interpolate(globalFrame, [0, totalFrames], panXRange, {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${zoomScale}) translateX(${panX}px)`,
        transformOrigin: "center center",
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={startFrom}
        volume={0}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// 多片段背景
// ─────────────────────────────────────────────
const MultiClipBackground: React.FC<{ game: GameItem }> = ({ game }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const { zoomRange, panXRange } = styleConfig.kenBurns;
  const clips = game.clips;

  if (!clips || clips.length === 0) {
    if (game.videoSrc) {
      const frame = useCurrentFrame(); // eslint-disable-line react-hooks/rules-of-hooks
      const zoomScale = interpolate(frame, [0, durationInFrames], zoomRange, {
        extrapolateRight: "clamp",
      });
      const panX = interpolate(frame, [0, durationInFrames], panXRange, {
        extrapolateRight: "clamp",
      });
      return (
        <AbsoluteFill
          style={{
            transform: `scale(${zoomScale}) translateX(${panX}px)`,
            transformOrigin: "center center",
          }}
        >
          <OffthreadVideo
            src={staticFile(game.videoSrc)}
            volume={0}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      );
    }
    return <FallbackBg game={game} />;
  }

  return (
    <>
      <FallbackBg game={game} />
      {clips.map((clip, idx) => {
        const clipFrames = Math.round(clip.durationSec * fps);
        const startFrame = clip.offsetSec != null
          ? Math.round(clip.offsetSec * fps)
          : (() => { let o = 0; for (let i = 0; i < idx; i++) o += Math.round(clips[i].durationSec * fps); return o; })();

        return (
          <Sequence
            key={`clip-${idx}`}
            from={startFrame}
            durationInFrames={clipFrames}
            layout="none"
          >
            <ClipWithKenBurns
              src={clip.src}
              startFrom={clip.startFrom ? Math.round(clip.startFrom * fps) : 0}
              globalStartFrame={startFrame}
              totalFrames={durationInFrames}
            />
          </Sequence>
        );
      })}
    </>
  );
};

// ─────────────────────────────────────────────
// GameplaySection
//
// 样式参数来源: style.config.yaml → cinematic.gameplay
// ─────────────────────────────────────────────
export const GameplaySection: React.FC<{
  game: GameItem;
  watermark: string;
  subtitleFontSize?: number;
  subtitleBottom?: number;
  subtitleStrokeWidth?: number;
  statFontSizeOverride?: number;
  statSkewX?: number;
  statScaleX?: number;
  statSpreadRatio?: number;
  watermarkFontSize?: number;
}> = ({
  game, watermark,
  subtitleFontSize, subtitleBottom, subtitleStrokeWidth,
  statFontSizeOverride, statSkewX, statScaleX, statSpreadRatio,
  watermarkFontSize,
}) => {
  const { fps, width, height } = useVideoConfig();
  const cine = styleConfig.cinematic.gameplay;

  return (
    <AbsoluteFill>
      <MultiClipBackground game={game} />

      {/* 底部渐变 */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.5) 100%)",
          zIndex: 10,
          pointerEvents: "none",
        }}
      />

      {game.subtitles.map((sub, i) => (
        <Sequence
          key={`sub-${i}`}
          from={Math.round(sub.startSec * fps)}
          durationInFrames={Math.round(sub.durationSec * fps)}
          layout="none"
        >
          <Subtitle
            text={sub.text}
            width={width}
            fontSizeOverride={subtitleFontSize}
            bottomOverride={subtitleBottom}
            strokeWidthOverride={subtitleStrokeWidth}
          />
        </Sequence>
      ))}

      {game.stats?.map((stat, i) => (
        <Sequence
          key={`stat-${i}`}
          from={Math.round(stat.startSec * fps)}
          durationInFrames={Math.round(stat.durationSec * fps)}
          layout="none"
        >
          <StatNumber
            value={stat.value}
            width={width}
            height={height}
            fontSizeOverride={statFontSizeOverride}
            skewXOverride={statSkewX}
            scaleXOverride={statScaleX}
            spreadRatioOverride={statSpreadRatio}
          />
        </Sequence>
      ))}

      <CinematicOverlay
        width={width}
        height={height}
        grainIntensity={cine.grain}
        vignetteIntensity={cine.vignette}
        zIndex={70}
      />

      <Watermark text={watermark} width={width} fontSizeOverride={watermarkFontSize} />
    </AbsoluteFill>
  );
};
