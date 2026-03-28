import { GaoShouRuYun } from "./GaoShouRuYun";
import { gaoShouRuYunSchema } from "./schema";
import type { TemplateDefinition } from "../registry";

export const gaoShouRuYunDefaultProps = {
  前段文字: "现在的最终boss:",
  后段文字: "以前的最终boss:",
  视频路径: "",
  音乐卡点秒: 40.6,
};

export const gaoShouRuYunTemplate: TemplateDefinition = {
  id: "GaoShouRuYun",
  component: GaoShouRuYun,
  schema: gaoShouRuYunSchema,
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 1797,
  defaultProps: gaoShouRuYunDefaultProps,
};
