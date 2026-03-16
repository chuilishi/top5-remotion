import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Watermark } from "./Watermark";
import { CinematicOverlay } from "./CinematicOverlay";
import { styleConfig } from "../config";

/**
 * 结尾黑屏 — 只加了颗粒和暗角保持一致性
 *
 * 样式参数来源: style.config.yaml → cinematic.ending, colors.globalBg
 */
export const EndingScene: React.FC<{
  watermark: string;
  watermarkFontSize?: number;
}> = ({ watermark, watermarkFontSize }) => {
  const { width, height } = useVideoConfig();
  const { grain, vignette } = styleConfig.cinematic.ending;

  return (
    <AbsoluteFill style={{ backgroundColor: styleConfig.colors.globalBg }}>
      <CinematicOverlay
        width={width}
        height={height}
        grainIntensity={grain}
        vignetteIntensity={vignette}
      />
      <Watermark text={watermark} width={width} fontSizeOverride={watermarkFontSize} />
    </AbsoluteFill>
  );
};
