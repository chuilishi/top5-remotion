import React from "react";
import { useCurrentFrame } from "remotion";

/**
 * 极简电影叠加 — 只做两件事:
 *   1. 微妙胶片颗粒 (几乎察觉不到，但去掉后会感觉"数码感"太强)
 *   2. 轻暗角 (自然聚焦视线)
 */
export const CinematicOverlay: React.FC<{
  width: number;
  height: number;
  grainIntensity?: number;
  vignetteIntensity?: number;
  zIndex?: number;
}> = ({
  width,
  height,
  grainIntensity = 0.035,
  vignetteIntensity = 0.2,
  zIndex = 200,
}) => {
  const frame = useCurrentFrame();
  const grainSeed = (frame * 7 + 13) % 500;

  return (
    <div
      style={{
        position: "absolute",
        top: 0, left: 0, width, height,
        zIndex,
        pointerEvents: "none",
      }}
    >
      {/* 胶片颗粒 — 极低强度，只是消除"太干净"的数码感 */}
      <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0, opacity: grainIntensity }}>
        <filter id={`g-${frame}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed={grainSeed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter={`url(#g-${frame})`} />
      </svg>

      {/* 暗角 — 非常轻，只是边缘微微压暗 */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, width, height,
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, rgba(0,0,0,${vignetteIntensity}) 100%)`,
        }}
      />
    </div>
  );
};
