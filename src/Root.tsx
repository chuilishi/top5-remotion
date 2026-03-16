import React from "react";
import { Composition } from "remotion";
import { Top5Video } from "./Top5Video";
import { StatNumberTest } from "./StatNumberTest";
import { top5Schema } from "./schema";
import { contentConfig, styleConfig, calculateTotalFrames } from "./config";

export const RemotionRoot: React.FC = () => {
  const data = contentConfig;
  const totalFrames = calculateTotalFrames(data);

  return (
    <>
      <Composition
        id="Top5Video"
        component={Top5Video}
        schema={top5Schema}
        durationInFrames={totalFrames}
        fps={data.fps}
        width={data.width}
        height={data.height}
        defaultProps={{
          开场标题: {
            字号: 304,
            行间距: -27,
            字间距系数: 1.05,
            描边粗细: 8,
            字符高度系数: 1.05,
          },
          排名数字: {
            容器尺寸: 630,
            数字字号: 540,
            空心描边线宽: 0.1,
            实心描边线宽: 12,
            滑入距离: 225,
            拖尾透明度: 0.6,
          },
          标题卡: {
            倾斜角度: -8,
            水平缩放: 0.88,
            水平偏移: 5,
            字号倍率: 1,
            字间距: 0.06,
            阴影偏移X: 7,
            阴影偏移Y: 9,
            光晕强度: 1,
            红色光晕半径: 22,
            第5名标题: "PUBG Mobile",
            第4名标题: "Subway Surfers",
            第3名标题: "Minecraft",
            第2名标题: "Candy Crush Saga",
            第1名标题: "王者荣耀",
          },
          字幕: { 字号: 86, 底部距离: 68, 描边粗细: 16 },
          统计数字: {
            字号: 162,
            倾斜角度: -6,
            水平缩放: 0.88,
            扩散系数: 0.29,
            第5名数值: "146,000,000+",
            第4名数值: "4,000,000,000+",
            第3名数值: "300,000,000+",
            第2名数值: "200,000,000+",
            第1名数值: "100,000,000+",
          },
          水印: { 内容: "", 字号: 54 },
        }}
        calculateMetadata={async () => ({
          durationInFrames: calculateTotalFrames(data),
          fps: data.fps,
          width: data.width,
          height: data.height,
        })}
      />
      <Composition
        id="StatNumberTest"
        component={StatNumberTest}
        durationInFrames={Math.round(
          data.timing.gameplayDurations[0] * data.fps,
        )}
        fps={data.fps}
        width={data.width}
        height={data.height}
      />
    </>
  );
};
