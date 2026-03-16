import React from "react";
import { AbsoluteFill } from "remotion";
import { GameplaySection } from "./components/GameplaySection";
import { contentConfig, styleConfig } from "./config";

/**
 * 测试合成 — 只渲染第一个游戏的 stat 数字动画
 */
export const StatNumberTest: React.FC = () => {
  const game = contentConfig.games[0];

  return (
    <AbsoluteFill style={{ backgroundColor: styleConfig.colors.globalBg }}>
      <GameplaySection game={game} watermark={contentConfig.watermark} />
    </AbsoluteFill>
  );
};
