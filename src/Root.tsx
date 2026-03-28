import React from "react";
import { Composition } from "remotion";
import {
  top5Template,
  top5DefaultProps,
  gaoShouRuYunTemplate,
  gaoShouRuYunDefaultProps,
} from "./templates";

const t5 = top5Template;
const gs = gaoShouRuYunTemplate;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={t5.id}
        component={t5.component}
        schema={t5.schema}
        durationInFrames={t5.durationInFrames}
        fps={t5.fps}
        width={t5.width}
        height={t5.height}
        defaultProps={top5DefaultProps}
        {...(t5.calculateMetadata ? { calculateMetadata: t5.calculateMetadata } : {})}
      />
      <Composition
        id={gs.id}
        component={gs.component}
        schema={gs.schema}
        durationInFrames={gs.durationInFrames}
        fps={gs.fps}
        width={gs.width}
        height={gs.height}
        defaultProps={gaoShouRuYunDefaultProps}
      />
    </>
  );
};
