# CLAUDE.md

Remotion 项目：生成 "Top 5" 倒计时视频（中文配音，Sodabobo_ 风格）。

## 核心命令

```bash
npm run config          # YAML → TypeScript 配置（修改 YAML 后必须运行）
npm run project -- <name>  # 切换项目（自动包含 config）
npm run start           # Remotion Studio 预览
npm run dev             # 启动全部服务（Studio + API Server + 剪辑 UI）
npm run build           # 最终渲染
uv run tts_gen.py --batch <file.json>  # Fish Audio TTS 批量生成
```

## 项目结构

```
style.config.yaml            ← 视觉风格（一般不改）
projects/{name}/             ← 每个视频项目
  project.yaml               ← 项目全局元数据（标题、fps、timing）
  rank_{1-5}_{folder}.yaml   ← 每个排名位的完整数据（唯一数据源）
  tts_batch.json             ← TTS 批量生成清单
public/{folder}/             ← 视频切片 + 音频文件
scripts/build-config.mjs     ← project.yaml + rank_*.yaml → src/config/*.ts
src/Top5Video.tsx            ← 主 Remotion 合成
src/components/              ← IntroScene, RankTransition, GameTitleCard, GameplaySection
```

## 视频结构

```
[Intro ~2s] → [#5 转场 ~2s] → [#5 画面 ~12-15s] → ... → [#1 转场 ~3s] → [#1 画面] → 硬切结束
```

- BGM 卡点：4s（#5 画面开始）、72s（#1 画面开始）
- 标题卡叠加在画面上（+0.4s 出现，1.5s 时长），不是独立段
- 品牌名配音 → 0.8s 间隔 → 正文配音开始，句间 0.3s

## 数据流

rank YAML 是唯一数据源。修改数据只改 rank YAML，然后：
1. `npm run project -- <name>`（或 `npm run config` 如果不切换项目）
2. 生成的 `src/config/content.config.ts` 不要手动编辑

## Agent 协作

5 个 VS Code Copilot agent（`.github/agents/`）：
- `@top5-video` — 全流程编排（调度其他 agent）
- `@material-researcher` — 素材调研（搜索视频素材 + 下载验证）
- `@copywriter` — 中文文案（内嵌 Sodabobo_ 风格参考 → 纯凭风格直觉写作，不接触研究资料）
- `@clip-editor` — 精确选片（Gemini 视频分析 → 高画质下载 → 切片）

流程：用户提供排名 → copywriter → material-researcher × 5 调研 → top5-video 填 YAML + 搜 stat → TTS → clip-editor × 5 → 合并渲染

## 关键约束

- `src/config/*.ts` 是自动生成的，不要手动编辑
- 视频文件用 `<OffthreadVideo>` 必须 `volume={0}`
- fps = 60
- TTS 语速：7.3 字/秒（Fish Audio, speed=1.3, atempo=1.1）
- 用 `staticFile()` 引用 public/ 下的文件
- 动画用 `useCurrentFrame()` + `interpolate()`，不用 CSS transition
