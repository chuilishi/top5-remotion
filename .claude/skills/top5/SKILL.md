---
name: top5
description: 做一期 Top5Video 倒计时视频（写文案 → 查 stat → 找素材 → 配音 → 卡点校验 → 选片切片）。用户说「做一期」并给出主题和 #5→#1 排名时使用。
argument-hint: <主题> <#5→#1 排名>
---

# Top 5 Solo

你独自完成一期 Top 5 倒计时视频：写文案 → 查 stat → 找素材 → 配音 → 卡点校验 → 选片切片。产出是 `projects/{project-name}/` 下的 YAML 和 `public/{project-name}/` 下的媒体文件，用户在 Remotion Studio 里预览和渲染。

整条流程由你一个人走完，只有文案交给 `copywriter` 子代理（见 Phase 2）。按 Claude Code 编写；此前的 VS Code Copilot 多 agent 版本已归档到 `docs/archive/vscode-copilot/`，不再维护。

## 需要的工具

| 用途 | 工具 | 说明 |
|---|---|---|
| 读写文件、跑命令 | Read / Write / Edit / Bash | 命令都在项目根目录执行 |
| 看截图 | Read（可直接读图片） | 素材目视验证用 |
| 网页搜索 | `mcp__tavily__tavily_search` | 查 stat、找素材线索 |
| 抓网页原文 | `mcp__firecrawl__firecrawl_scrape` | stat 摘要不够确定时核实 |
| YouTube 搜索/下载 | `mcp__ytdlp__ytdlp_search` / `ytdlp_channel_list` / `ytdlp_download` | 本地服务 `tools/ytdlp-mcp.mjs`，账号配置见 `tools/ytdlp-accounts.json` |
| B站搜索/下载 | `mcp__bili__bili_search` / `bili_user_videos` / `bili_download` | 本地服务 `tools/bili-mcp.mjs` |
| 视频分析选片 | `mcp__gemini-media__analyze_media` | 本地服务 `tools/gemini-media-mcp.mjs` |

三个本地 MCP 服务注册在项目根的 `.mcp.json`；Tavily 和 Firecrawl 是用户级 MCP 服务，不在本仓库里。

## 阶段规范从哪里读

较长的规范是本 skill 目录下的附属文件（`.claude/skills/top5/`），每份只维护一处。**到对应阶段再去读**，不要一开始全部读完。读的时候只取下面指明的章节；这些文件开头的角色设定和 Input 格式是多 agent 时代留下的，与你无关。

| 阶段 | 读哪里 | 取哪些章节 |
|---|---|---|
| 写文案 | 不用读——交给 `copywriter` 子代理，它自己读 `.claude/skills/top5/copywriter.md` | — |
| 找素材 | `.claude/skills/top5/material-researcher.md` | `## 为什么素材质量是第一优先级` 到 `## Output` 之前的全部内容 |
| 选片 | `.claude/skills/top5/clip-editor.md` | `## 视频风格上下文`、`## Workflow` 下的 Step 1-4（含 Gemini 固定提示词模板） |

## 要特别注意的两件事

**1. 文案必须最先写，写完再碰任何资料。**
参考文案的味道来自风格直觉：有梗、有态度的定位句，而不是资料摘抄。一旦先看了调研资料，写出来的就会变成摘抄。这层隔离由 `copywriter` 子代理保证：它只有 Read 权限、没有任何搜索工具，输入也只有主题和排名。它的提示词刻意只有一句「模仿参考文案的风格」——任何额外要求都会让模型产生倾向，不要往里加。你仍要在搜索任何东西之前拿到 5 段定稿；之后查到的 stat 和素材信息**不要回填进文案**，也不要传给子代理；卡点校验要求改文案时，同样交给子代理按秒数改写。

**2. 上下文会很长，用文件做存档点。**
一期视频要经过几十次搜索、截图和 Gemini 调用。每个排名位的素材调研一结束，立刻按 material-researcher 的 `## Output` 格式写 `projects/{project-name}/research-{NN}-{folder}.md`；后面选片时以这个文件为准，不要凭记忆。用 todo list 逐个排名位跟踪进度，避免做完两三个就"忘了"剩下的。

## Workflow

### Phase 1: 建项目

用户提供主题和 #5→#1 排名。

1. 创建 `projects/{project-name}/`，按 `template.project.yaml` 写 `project.yaml`（填标题，timing 保持模板默认，**不要写 gameplayDurations**）
2. 为每个排名位确定 `folder` = titleEn 的 kebab-case（如 `unreal-engine`），后续所有路径都用它

### Phase 2: 文案

用 Agent 工具调用 `copywriter` 子代理（`subagent_type: "copywriter"`），prompt **只**写下面格式的内容，不附加任何别的信息：

```
主题：{topic}
排名列表：
#5 — {title}
#4 — {title}
#3 — {title}
#2 — {title}
#1 — {title}
```

**调用时不要传 `model` 参数。** 子代理在 `.claude/agents/copywriter.md` 里固定用 `claude-opus-4-6`；调用时传入的 `model`（哪怕是 `opus`）优先级更高，会把它换成别的模型。

子代理返回 5 段旁白（每段 55-70 字）。你不要改写措辞，只负责下面的切分和建文件。

然后按 `template.rank.yaml` 格式创建 5 个 `rank_{rank}_{folder}.yaml`：
- 每段文案按**分句标点**切分：句号、逗号、分号、问号、感叹号。**顿号不切**。每句一个 voiceover 条目，subtitles 与之一一对应、文字相同
- `stats` 按模板保留一条，`value` 先留空
- **不写任何时间字段，不写 clips**

### Phase 3: stat

1. 为 5 个排名位选**一个统一、可比**的数据维度及单位（如全球门店数 → `"40,000 门店"`，全球票房 → `"$29亿 票房"`）
2. 用 Tavily 逐个查。优先官方财报/年报、权威统计机构、主流媒体；来源冲突取最新且最权威的；摘要不够确定时用 Firecrawl 抓原文
3. 填进 `stats[0].value`，写成观众一眼能懂的短文本并带单位
4. 某个排名位查不到可靠数据：先考虑换一个 5 家都能查到的维度；换不了就留空并在最终报告里说明，**不要估算或编造**

### Phase 4: 找素材（逐个排名位）

读 material-researcher 的规范，对 #5 → #1 **逐个**执行：搜索 → 元数据预筛 → 下载预览版到 `temp_analysis/{project-name}/{folder}/` → 截帧 → 目视验证。

每个排名位要有 2-4 个验证通过的视频，完成一个就写一个 `research-{NN}-{folder}.md`，再做下一个。

### Phase 5: 配音 + 时间轴

1. 生成**品牌名配音**条目：
   - **类型 A**（英文名有对应的自然中文名，如 Unreal Engine → 虚幻引擎）：EN + ZH 两个音频
   - **类型 B**（只有英文名，或中文名只是品牌名+通用词，或品牌本身是中文）：一个音频

   在 rank YAML 中添加 `brandVoiceover`（只写 `src` + `text`，格式见 `template.rank.yaml`）。

2. 把全部品牌名条目和 voiceover 句子写进 `projects/{project-name}/tts_batch.json`：

```json
[
  {"text": "Cocos Creator", "out": "public/{project-name}/{folder}/brand_en.mp3"},
  {"text": "第一句文案", "out": "public/{project-name}/{folder}/vo_01.mp3"}
]
```

3. 生成配音并填时间轴：

```bash
uv run tts_gen.py --batch projects/{project-name}/tts_batch.json | node scripts/fill-timeline.mjs {project-name}
```

   **项目名参数不能省**：省略时脚本读 `.current-project`，此时它还指向上一个项目。
   **不要手动解析 TTS 输出，不要手算或手填任何秒数。**

### Phase 6: 卡点校验

1. 运行 `npm run project -- {project-name}`
2. 报 `ERROR`（超出 72s 卡点，或 #1 配音过长）或 `Warning`（配音过短）时：
   - 按约 6 字/秒把报错秒数换算成目标字数，把该段原文交给 `copywriter` 子代理，prompt 只写原文和一句「改成约 N 字」（同样不传 `model`，不附带任何别的信息）
   - 重新切分 voiceover → 重建**完整的** tts_batch.json 并重跑 TTS + fill-timeline（脚本要求 5 个排名位的每个音频都在本次输出里，只跑部分会报 `MISSING`）→ 重新 `npm run config`
   - 反复调整仍不达标则接受，并在最终报告中备注
3. 通过后记下终端打印的 `[Top5Video] gameplayDurations: ...`（顺序 **#5 → #1**），作为选片的目标时长

### Phase 7: 选片切片（逐个排名位）

读 clip-editor 的规范，对 #5 → #1 **逐个**执行 Step 1-4：
- Gemini 选片（输入是该排名位 research 文件里 `## Verified videos` 的预览文件，提示词模板**原文**传入，只替换 `{target_duration}`）
- `node scripts/cut-clips.mjs ... --sections` → 按输出下载高画质分段
- `node scripts/cut-clips.mjs ...` → 切片并写入 clips
- 看警告，决定是否返工

### Phase 8: 收尾

1. 运行 `npm run config`，把 clips 同步进 `public/_active/`
2. 通知用户可以预览，并汇总：各排名位的 stat 与来源、未解决的切片警告、未能消除的卡点问题

## 约束

- rank YAML 是唯一内容数据源；project.yaml 只存全局元数据
- `src/templates/active.ts` 和 `public/_active/` 是自动生成的，不要手动编辑
- 时间字段和 clips 只由 `fill-timeline.mjs` / `cut-clips.mjs` 写，不要手写
- 媒体文件放 `public/{project-name}/{folder}/`；调研和下载的中间文件只进 `temp_analysis/`，严禁下载到项目根目录
