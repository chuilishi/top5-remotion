import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { Watermark } from "./Watermark";
import { CinematicOverlay } from "./CinematicOverlay";
import { styleConfig } from "../config";

/**
 * 排名数字过渡
 *
 * 样式参数来源: style.config.yaml → rankNumber, fonts, colors, cinematic.rankTransition
 */
export const RankTransition: React.FC<{
  rank: number;
  watermark: string;
  rankSvgSize: number;
  rankFontSize: number;
  rankOutlineStroke: number;
  rankFillStroke: number;
  rankSlideDistance: number;
  rankTrailPeak: number;
  watermarkFontSize?: number;
}> = ({ rank, watermark, rankSvgSize, rankFontSize, rankOutlineStroke, rankFillStroke, rankSlideDistance, rankTrailPeak, watermarkFontSize }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const FONT_TITLE = styleConfig.fonts.title;
  const GOLD_GRADIENT_STOPS = styleConfig.colors.goldGradient;
  const svgSize = rankSvgSize;
  const fontSize = rankFontSize;
  const lineStrokeWidth = rankOutlineStroke;
  const goldStrokeWidth = rankFillStroke;
  const goldStroke = styleConfig.colors.goldStroke;
  const cine = styleConfig.cinematic.rankTransition;

  const textX = svgSize / 2;
  const textY = Math.round(svgSize * 0.78);

  // 从下方滑入中心
  const slideY = interpolate(frame, [2, 14], [rankSlideDistance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // 出现时机
  const numberOpacity = interpolate(frame, [1, 4], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 退出淡出
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 实心填充过渡（在后段快速从描边变为实心金色）
  const solidFillOpacity = interpolate(
    frame,
    [durationInFrames * 0.70, durationInFrames * 0.80],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 拖尾残影
  const trailOpacity = interpolate(frame, [2, 8, 18], [0, rankTrailPeak, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const seedForRank = 1.5;

  // 渲染单个数字
  const renderNumber = (extraStyle: React.CSSProperties, key: string) => (
    <svg
      key={key}
      width={svgSize}
      height={svgSize}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      style={{ position: "absolute", overflow: "visible", ...extraStyle }}
    >
      <defs>
        <filter
          id={`nglow-${rank}-${key}`}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
          <feFlood floodColor={styleConfig.colors.glowColor} floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient
          id={`gold-${rank}-${key}`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          {GOLD_GRADIENT_STOPS.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>

      {/* 镂空描边 (前期) — 只有轮廓无填充 */}
      <text
        x={textX}
        y={textY}
        textAnchor="middle"
        fontFamily={FONT_TITLE}
        fontWeight="900"
        fontSize={fontSize}
        fill="none"
        stroke={styleConfig.colors.glowColor}
        strokeWidth={lineStrokeWidth}
        strokeLinejoin="round"
        filter={`url(#nglow-${rank}-${key})`}
        opacity={1 - solidFillOpacity}
      >
        {rank}
      </text>

      {/* 金属渐变填充 (后期) — 加深色描边 */}
      <text
        x={textX}
        y={textY}
        textAnchor="middle"
        fontFamily={FONT_TITLE}
        fontWeight="900"
        fontSize={fontSize}
        fill={`url(#gold-${rank}-${key})`}
        stroke={goldStroke}
        strokeWidth={goldStrokeWidth}
        strokeLinejoin="round"
        filter={`url(#nglow-${rank}-${key})`}
        paintOrder="stroke"
        opacity={solidFillOpacity}
      >
        {rank}
      </text>
    </svg>
  );

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}
      >
        <div
          style={{
            position: "relative",
            width: svgSize,
            height: svgSize,
            opacity: numberOpacity,
          }}
        >
          {/* 拖尾残影 */}
          {[
            { offset: 146, opacity: 0.08 },
            { offset: 117, opacity: 0.14 },
            { offset: 90,  opacity: 0.22 },
            { offset: 63,  opacity: 0.32 },
            { offset: 36,  opacity: 0.44 },
            { offset: 16,  opacity: 0.58 },
          ].map((t, i) =>
            renderNumber(
              {
                transform: `translateY(${slideY + t.offset}px)`,
                opacity: trailOpacity * t.opacity,
              },
              `trail${i}`
            )
          )}

          {/* 主体数字 */}
          {renderNumber(
            {
              transform: `translateY(${slideY}px)`,
            },
            "main"
          )}
        </div>
      </div>

      <CinematicOverlay
        width={width}
        height={height}
        vignetteIntensity={cine.vignette}
      />
      <Watermark text={watermark} width={width} fontSizeOverride={watermarkFontSize} />
      <Audio src={staticFile(`number/number_${rank}.mp3`)} volume={1} />
    </AbsoluteFill>
  );
};
