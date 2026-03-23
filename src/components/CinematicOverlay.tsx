import React from "react";

/**
 * 极简电影叠加 — 轻暗角 (自然聚焦视线)
 */
export const CinematicOverlay: React.FC<{
  width: number;
  height: number;
  vignetteIntensity?: number;
  zIndex?: number;
}> = ({
  width,
  height,
  vignetteIntensity = 0.2,
  zIndex = 200,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0, left: 0, width, height,
        zIndex,
        pointerEvents: "none",
      }}
    >
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
