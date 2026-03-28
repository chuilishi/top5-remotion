# CLAUDE.md

Remotion 项目：多模板视频生成工具。

## 核心命令

```bash
npm run config          # YAML → TypeScript 配置（修改 YAML 后必须运行）
npm run project -- <name>  # 切换项目（自动包含 config + 切换模板）
npm run start           # Remotion Studio 预览（自动打开当前项目的模板）
npm run dev             # 启动全部服务（Studio + API Server + 剪辑 UI）
npm run build           # 最终渲染
uv run tts_gen.py --batch <file.json>  # Fish Audio TTS 批量生成
```

## 项目结构

```
projects/{name}/             ← 每个视频项目
  project.yaml               ← template + 项目元数据
  rank_{1-5}_{folder}.yaml   ← Top5 模板专用数据文件
public/{folder}/             ← 视频切片 + 音频文件
scripts/
  build-config.mjs           ← project.yaml → active.ts + public/_active/content.json
  switch-project.mjs         ← 切换项目 + 触发 config
src/
  Root.tsx                    ← 注册所有 Composition（多模板）
  templates/
    active.ts                 ← 自动生成：当前活跃模板 ID
    registry.ts               ← TemplateDefinition 类型定义
    index.ts                  ← templateMap + activeTemplate 导出
    top5/                     ← Top5Video 模板
      config/style.config.ts  ← 手维护视觉风格
    gaoshou-ru-yun/           ← GaoShouRuYun 模板
public/_active/               ← 自动生成：当前项目的原始数据 JSON
```

## 多模板架构

每个项目的 `project.yaml` 第一行声明 `template`：

```yaml
template: Top5Video      # 使用哪个 Composition
titleLine1: 全球前五
...
```

一个模板可以被多个项目使用（不同数据，相同模板）。

### 运行时配置加载

`npm run config` 生成 `public/_active/content.json`（纯数据，无计算）。
`calculateMetadata` 在运行时 fetch 该 JSON，计算时序（72s 卡点、buffer 分配），
通过 props 传递给组件。无代码生成。

### 添加新模板

1. 创建 `src/templates/<name>/`（组件 + schema + index.ts）
2. 在 `src/templates/index.ts` 的 `templateMap` 加一行
3. 在 `src/Root.tsx` 添加 `<Composition>` 注册
4. 创建 `projects/<name>/project.yaml`，写 `template: <CompositionId>`

### TemplateDefinition 接口

```ts
interface TemplateDefinition {
  id: string;                    // Composition ID
  component: React.FC<any>;
  schema: z.ZodType;
  width: number; height: number; fps: number;
  durationInFrames: number;
  defaultProps: Record<string, any>;
  calculateMetadata?: () => Promise<{...}>;  // 可选：动态计算
}
```

## 视频结构

```
[Intro ~2s] → [#5 转场 ~2s] → [#5 画面 ~12-15s] → ... → [#1 转场 ~3s] → [#1 画面] → 硬切结束
```

- BGM 卡点：4s（#5 画面开始）、72s（#1 画面开始）
- 标题卡叠加在画面上（+0.4s 出现，1.5s 时长），不是独立段
- 品牌名配音 → 0.8s 间隔 → 正文配音开始，句间 0.3s

## 数据流

rank YAML 是 Top5 模板的唯一数据源。修改数据只改 rank YAML，然后：
1. `npm run project -- <name>`（或 `npm run config` 如果不切换项目）
2. 生成 `public/_active/content.json`（纯数据），运行时 `calculateMetadata` 加载并计算时序

## Agent 协作

5 个 VS Code Copilot agent（`.github/agents/`）：
- `@top5-video` — 全流程编排（调度其他 agent）
- `@material-researcher` — 素材调研（搜索视频素材 + 下载验证）
- `@copywriter` — 中文文案（内嵌 Sodabobo_ 风格参考 → 纯凭风格直觉写作，不接触研究资料）
- `@clip-editor` — 精确选片（Gemini 视频分析 → 高画质下载 → 切片）

流程：用户提供排名 → copywriter → material-researcher × 5 调研 → top5-video 填 YAML + 搜 stat → TTS → clip-editor × 5 → 合并渲染

## 关键约束

- `src/templates/active.ts` 是自动生成的，不要手动编辑
- `public/_active/` 是自动生成的，不要手动编辑
- 视频文件用 `<OffthreadVideo>` 必须 `volume={0}`
- fps = 60
- TTS 语速：7.3 字/秒（Fish Audio, speed=1.3, atempo=1.1）
- 用 `staticFile()` 引用 public/ 下的文件
- 动画用 `useCurrentFrame()` + `interpolate()`，不用 CSS transition
