# 高手如云 (GaoShouRuYun) 模板

抖音/B站经典梗视频模板——"现在的 xxx" vs "以前的 xxx" 对比，配合 BGM 卡点产生反差效果。

## 视频规格

| 属性 | 值 |
|------|-----|
| 分辨率 | 1920×1080 (横屏 16:9) |
| 帧率 | 30fps |
| 总帧数 | 750 (25s) |

## 结构时间线

视频分为**前段**（3 段素材）和**后段**（4 个 beat clip）两部分，通过亮度过渡衔接。

### 前段（帧 0–499）

3 段视频均分前半段时间（每段 ≈167 帧 ≈5.6s），顶部显示 `前段文字`。每段可指定起始秒 (`前段起始秒1/2/3`)。

### 过渡

| 帧 | 时间 | 事件 |
|----|------|------|
| 493 | 0:16.4 | 画面亮度开始降低（dim overlay 渐入） |
| 500 | 0:16.7 | **切换点**：文字切换为 `后段文字`，后段 clip 1 开始 |
| 515 | 0:17.2 | 画面恢复正常亮度 |

### 后段 Beat Clips（帧 500–750）

4 个 beat clip 依次出现。每个 clip 先正常播放若干帧，到达 beat 帧时**冻结最后一帧**（`<Freeze>`），直到下一个 clip 开始。

| Beat | Clip 开始帧 | Beat 帧 | 播放帧数 | 播放时长 | Clip 总帧数 | Clip 总时长 |
|------|-----------|---------|---------|---------|-----------|-----------|
| 1 | 500 | 530 | 30 | 1.0s | 70 | 2.33s |
| 2 | 570 | 585 | 15 | 0.5s | 55 | 1.83s |
| 3 | 625 | 640 | 15 | 0.5s | 55 | 1.83s |
| 4 | 680 | 695 | 15 | 0.5s | 70 | 2.33s |

**素材制作要点**：Beat 2/3/4 只有 0.5s 有效播放，然后冻结在最后一帧停留 ≈1.3s。建议切 ≈3s 片段留足余量。

## Props (schema)

```typescript
{
  前段文字: string       // 前半段显示的文字
  后段文字: string       // 后半段显示的文字
  前段视频1: string      // 前段第 1 段视频路径（staticFile 相对路径）
  前段视频2: string      // 前段第 2 段
  前段视频3: string      // 前段第 3 段
  前段起始秒1: number    // 前段第 1 段的起始秒数
  前段起始秒2: number    // 前段第 2 段的起始秒数
  前段起始秒3: number    // 前段第 3 段的起始秒数
  后段视频1: string      // Beat 1 clip 路径
  后段视频2: string      // Beat 2 clip 路径
  后段视频3: string      // Beat 3 clip 路径
  后段视频4: string      // Beat 4 clip 路径
}
```

Props 通过 `public/_active/project.json` 覆写（`calculateMetadata` 自动加载）。

## 音频对齐机制

BGM 文件为 `public/高手如云的小曲.mp3`。模板通过常量 `MUSIC_BEAT_SEC`（默认 40.6）计算 `trimBefore`，使 BGM 中的节拍点精确落在第 530 帧（视频主卡点）。

公式：`trimBefore = (MUSIC_BEAT_SEC - FRAME.GRAPHIC_EFFECT / 30) × fps`

## 视觉效果

- **Dim Overlay**：帧 493–515 之间通过黑色遮罩 opacity 实现亮度渐暗→渐亮过渡
- **Chromatic Aberration**：色差分离效果（SVG filter），在每个 beat 帧到下一个 clip 开始之间触发（偏移量 12px）

## 文件结构

```
gaoshou-ru-yun/
├── GaoShouRuYun.tsx         # 主组件（含 BeatClip + Freeze 逻辑）
├── ChromaticAberration.tsx   # 色差效果组件
├── schema.ts                # Zod schema + 类型定义
├── index.ts                 # 导出 + 默认 props + calculateMetadata
└── README.md
```
