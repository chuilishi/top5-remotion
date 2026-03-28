import React from "react";
import { Composition } from "remotion";
import { Top5Video, top5Schema, top5DefaultProps, top5CalculateMetadata } from "./templates/top5";
import { GaoShouRuYun, gaoShouRuYunSchema, gaoShouRuYunDefaultProps } from "./templates/gaoshou-ru-yun";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Top5Video"
        component={Top5Video}
        schema={top5Schema}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={top5DefaultProps}
        calculateMetadata={top5CalculateMetadata}
      />
      <Composition
        id="GaoShouRuYun"
        component={GaoShouRuYun}
        schema={gaoShouRuYunSchema}
        durationInFrames={1797}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={gaoShouRuYunDefaultProps}
      />
    </>
  );
};
