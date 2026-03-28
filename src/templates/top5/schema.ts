import { z } from "zod";

export const top5Schema = z.object({
  开场标题: z.object({
    字号: z.number().min(60).max(400),
    行间距: z.number().min(-30).max(60),
    字间距系数: z.number().multipleOf(0.01).min(0.7).max(1.3),
    描边粗细: z.number().multipleOf(0.5).min(0).max(20),
    字符高度系数: z.number().multipleOf(0.01).min(0.8).max(1.5),
  }),
  排名数字: z.object({
    容器尺寸: z.number().min(150).max(800),
    数字字号: z.number().min(100).max(700),
    空心描边线宽: z.number().multipleOf(0.1).min(0).max(30),
    实心描边线宽: z.number().multipleOf(0.1).min(0).max(30),
    滑入距离: z.number().min(30).max(250),
    拖尾透明度: z.number().multipleOf(0.05).min(0).max(1.5),
  }),
  标题卡: z.object({
    倾斜角度: z.number().min(-20).max(5),
    水平缩放: z.number().multipleOf(0.01).min(0.5).max(1.2),
    水平偏移: z.number().min(-15).max(15),
    字号倍率: z.number().multipleOf(0.01).min(0.5).max(2.0),
    字间距: z.number().multipleOf(0.01).min(0).max(0.5),
    阴影偏移X: z.number().min(-20).max(20),
    阴影偏移Y: z.number().min(-20).max(20),
    光晕强度: z.number().multipleOf(0.05).min(0).max(2.0),
    红色光晕半径: z.number().min(0).max(60),
    第5名标题: z.string(),
    第4名标题: z.string(),
    第3名标题: z.string(),
    第2名标题: z.string(),
    第1名标题: z.string(),
  }),
  字幕: z.object({
    字号: z.number().min(40).max(150),
    底部距离: z.number().min(10).max(250),
    描边粗细: z.number().min(0).max(30),
  }),
  统计数字: z.object({
    字号: z.number().min(60).max(300),
    倾斜角度: z.number().min(-15).max(5),
    水平缩放: z.number().multipleOf(0.01).min(0.5).max(1.2),
    扩散系数: z.number().multipleOf(0.01).min(0).max(0.6),
    第5名数值: z.string(),
    第4名数值: z.string(),
    第3名数值: z.string(),
    第2名数值: z.string(),
    第1名数值: z.string(),
  }),
  水印: z.object({
    内容: z.string(),
    字号: z.number().min(20).max(100),
  }),
});

export type Top5Props = z.infer<typeof top5Schema>;
