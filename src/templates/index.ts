export { top5Template, top5DefaultProps } from "./top5";
export { gaoShouRuYunTemplate, gaoShouRuYunDefaultProps } from "./gaoshou-ru-yun";
export type { TemplateDefinition } from "./registry";

import { top5Template } from "./top5";
import { gaoShouRuYunTemplate } from "./gaoshou-ru-yun";
import { activeTemplateId } from "./active";
import type { TemplateDefinition } from "./registry";

const templateMap: Record<string, TemplateDefinition> = {
  Top5Video: top5Template,
  GaoShouRuYun: gaoShouRuYunTemplate,
};

export const activeTemplate: TemplateDefinition = templateMap[activeTemplateId] ?? top5Template;
