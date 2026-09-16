# AGENTS.md

Remotion 项目：多模板视频生成工具。

## 核心命令

```bash
npm run config          # YAML → TypeScript 配置（修改 YAML 后必须运行）
npm run project -- <name>  # 切换项目（自动包含 config + 切换模板）
npm run start           # Remotion Studio 预览（自动打开当前项目的模板）
npm run dev             # 启动 Remotion Studio
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

1. 创建 `src/templates/<name>/`（组件 + schema + index.ts 导出）
2. 在 `src/Root.tsx` 添加 `<Composition>` 注册
3. 创建 `projects/<name>/project.yaml`，写 `template: <CompositionId>`

> Studio 会显示 "Can't save default props" 警告（Remotion AST 限制，不影响预览和渲染）

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

## Remotion 依赖（官方 npm 包）

Remotion 4.0.525，全部来自官方 npm registry。**不再使用本地源码 fork**。

历史：项目曾从 `remotion-src/` 源码构建 17 个 tarball，为的是拿到 NVENC 硬件编码。
源码保存在私有仓库 `chuilishi/remotion-custom`（未删除）；本地的 `remotion-local/` 已整个移除，
补丁内容可用 `git show 642b7a2:remotion-local/remotion-source.patch` 取回。
这些改动现在要么已进上游，要么已无必要：

| 原改动 | 现状 |
|---|---|
| NVENC 编码（`get-codec-name.ts`） | 上游 **4.0.484** 已加入 Linux/Windows NVENC |
| FFmpeg 替换为 BtbN build | 不需要，官方 compositor 内置 `h264_nvenc` / `hevc_nvenc` |
| `libfdk_aac` → 原生 `aac` | 不需要，官方 FFmpeg 含 `libfdk_aac`（BtbN build 是 `--disable-libfdk-aac` 才要改） |
| Rust NVDEC 解码 | 未进上游。FFmpeg 侧 NVDEC 可用，但 Remotion 解码路径实测无收益（见下方解码数据） |
| `--enable-gpu-rasterization` | 未进上游，**且从未实测过收益**。如确需，用 `patch-package` 打一行补丁，不要重新 fork |

### NVENC 前提条件

**NVIDIA 驱动必须 >= 551.76**（FFmpeg 7.1 的 `h264_nvenc` 要求 NVENC API 12.2）。

当前机器：GTX 1060 6GB + **Studio Driver 581.57**（2025-10-09），NVENC / NVDEC 均已验证可用。
注意 GTX 1060 是 Pascal，581.x 是最后一代功能驱动，之后只有安全更新（到 2028-10），不要再指望升级。

历史教训：此前驱动是 391.35（2018 年），只有 NVENC API 8.1，
`--hardware-acceleration=required` 会直接崩在 `Error: write EOF`。
**如果哪天渲染又崩在这个错误上，第一个要查的就是驱动版本。**

验证方法（查驱动版本）：
```powershell
(Get-CimInstance Win32_VideoController | Where-Object Name -like 'NVIDIA*').DriverVersion
nvidia-smi --query-gpu=name,driver_version --format=csv
```

实测 NVENC / NVDEC（`-f lavfi -i nullsrc` 走不到编码器，必须喂真实帧）：
```bash
FF=node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe
"$FF" -y -i public/background.jpg -vf scale=1920:1080 -q:v 2 /tmp/f.jpg
for i in $(seq 1 120); do cat /tmp/f.jpg; done > /tmp/frames.mjpeg
# 编码：应正常出片
"$FF" -r 60 -f image2pipe -vcodec mjpeg -i /tmp/frames.mjpeg -c:v h264_nvenc -b:v 12M -y /tmp/t.mp4
# 解码：应打印 "NVDEC capabilities" 和 "pix_fmt: cuda"
"$FF" -v verbose -hwaccel cuda -i /tmp/t.mp4 -c:v libx264 -preset ultrafast -y /tmp/t2.mp4
```
驱动过旧的症状：编码报 `Driver does not support the required nvenc API version`，
解码报 `Failed loading nvcuvid`（且**静默回退软解**，退出码为 0，不会报错）。

### 实测数据（581.57 驱动，1200 帧 1080p60）

编码：**NVENC 42s vs libx264(fast) 51s，快 18%**。
所以 `render.ps1` 用 `--hardware-acceleration=required`（硬报错优于静默回退）。

**不要传 `--x264-preset`。** Remotion 无条件把它转成 ffmpeg 的 `-preset`
（`ffmpeg-args.js` 里没有按 `hardwareAccelerated` 门控），所以它会落到 `h264_nvenc` 上，
而在 NVENC 语义里 `slow` 是 legacy 的「hq 2 passes」。实测 600 帧 1080p60：

| preset | 耗时 | 输出 |
|---|---|---|
| 默认 `p4` | 2648 / 2669 ms | 391 KB |
| `slow` | 3084 / 3130 ms | 433 KB |
| `p7`（NVENC 最高质量） | 2884 / 2885 ms | 426 KB |

`slow` 比默认慢 17%，也比质量更高的 `p7` 慢——纯亏。而 `p7` 无法经此 flag 传入：
`x264PresetOptions` 是只收 x264 名字的硬白名单，传 NVENC 的 `pN` 会抛 `TypeError`。
真要调 NVENC 质量只能走 `--ffmpeg-override`。

解码：**`<OffthreadVideo>` 107s vs `@remotion/media` 的 `<Video>` 115s，OffthreadVideo 快 8%**
（各跑两轮、第二轮反序；日志确认 `@remotion/media` 未回退，走的是真 WebCodecs）。
官方虽推荐 `@remotion/media`，但 headless Chrome 似乎没有启用硬件视频解码——
FFmpeg 侧 NVDEC 可用不代表 Chrome 的 WebCodecs 会用它。
驱动升级前后各测过一次，两次数据一致。但性能不是最终的决定因素——见下一节。

### ⚠️ `@remotion/media` 无法解码 NVENC 编出的 H.264

曾尝试迁移到 `@remotion/media` 的 `<Video>`，实测发现它**解不了 NVENC 编码的 H.264**，
表现为 `delayRender` 挂 28 秒后整个渲染中止，错误信息只说
`Timeout while extracting frame at time X from ...`，不提编码器或像素格式，极难定位。

隔离过程（同一批帧，逐项排除）：

| 素材 | 色域 | `@remotion/media` | `OffthreadVideo` |
|---|---|---|---|
| NVENC，静止内容 | pc | ❌ 超时 | ✅ |
| NVENC，有运动内容 | pc | ❌ 超时 | ✅ |
| libx264，静止内容 | tv | ✅ | — |
| libx264，静止内容 | pc | ✅ | — |

已排除：并发（`--concurrency=1` 同样失败）、关键帧结构（补成每秒一个 IDR 仍失败）、
色域（libx264 全色域正常）、内容退化（有真实运动仍失败）。变量锁定在**编码器**。

影响：`@clip-editor` 下载的是平台转码流（libx264/VP9/AV1），日常碰不到；
但 OBS/ShadowPlay 录制且未经转码的片源、以及把本项目 NVENC 成片回灌当素材，都会触发。
**这是继续用 `<OffthreadVideo>` 的主要理由**（性能只是次要因素）。

### 渲染

```powershell
.\render.ps1   # --hardware-acceleration=required，NVENC 失效会硬报错
```

配置：`remotion.config.ts` 使用 JPEG 截图（比 PNG 快）、ANGLE OpenGL、16 并发、
OffthreadVideo 缓存沿用上游自适应默认值（理由见该文件注释）

## 关键约束

- `src/templates/active.ts` 是自动生成的，不要手动编辑
- `public/_active/` 是自动生成的，不要手动编辑
- 视频文件用 `<OffthreadVideo>` 必须 `volume={0}`
- `@remotion/media` 的 `<Video>`（`gaoshou-ru-yun` 模板在用）要用 `objectFit` prop，不能把 `objectFit` 写进 `style`
- fps = 60
- TTS 语速：7.3 字/秒（Fish Audio, speed=1.3, atempo=1.1）
- 用 `staticFile()` 引用 public/ 下的文件
- 动画用 `useCurrentFrame()` + `interpolate()`，不用 CSS transition
