import { z } from "zod";

export const gaoShouRuYunSchema = z.object({
  前段文字: z.string(),
  后段文字: z.string(),
  视频路径: z.string(),
  音乐卡点秒: z.number(),
});

export type GaoShouRuYunProps = z.infer<typeof gaoShouRuYunSchema>;
