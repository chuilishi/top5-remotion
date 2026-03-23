<p align="center">
  <img src="https://img.shields.io/badge/Remotion-4.0-6C47FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMloiIGZpbGw9IiNmZmYiLz48L3N2Zz4=" alt="Remotion 4.0"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
</p>

<h1 align="center">🏆 Top 5 Remotion</h1>

<p align="center">
  <strong>Programmatic "Top 5" countdown videos with cinematic fast-cut editing</strong>
  <br/>
  <sub>YAML-driven · AI-assisted · Inspired by <a href="https://space.bilibili.com/49351004">Sodabobo_</a></sub>
</p>

---

## ✨ What is this?

A **Remotion-based video template** for generating high-energy "Top 5" countdown videos — the kind with rapid cuts, gold-gradient typography, cinematic overlays, and dramatic rank transitions.

Define your content in a simple YAML file, drop in video clips, and render a polished video programmatically.

```
📝 YAML Config  →  🎬 Remotion Render  →  🎥 Final Video
```

## 🎬 Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Research    │────▶│  Download &  │────▶│  Configure   │────▶│   Render    │
│  (AI Agent)  │     │  Clip Videos │     │  YAML + TS   │     │  (Remotion) │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
```

## 🏗️ Architecture

```
top5-remotion/
├── style.config.yaml        # 🎨 Style: fonts, colors, animation params
├── projects/                # 📂 Multi-project support
│   └── game-demo/
│       ├── project.yaml         # 📝 Global metadata (title, fps, timing)
│       └── rank_*.yaml          # 🎮 Per-rank data (primary data source)
├── src/
│   ├── Top5Video.tsx        # 🎬 Main composition
│   └── components/
│       ├── IntroScene.tsx       # Opening title sequence
│       ├── GameTitleCard.tsx     # Rank title overlay (appears on gameplay)
│       ├── GameplaySection.tsx   # Fast-cut gameplay montage
│       ├── RankTransition.tsx    # Animated rank transitions
│       ├── CinematicOverlay.tsx  # Film grain + vignette + letterbox
│       ├── TornPaperEffect.tsx   # Torn paper reveal effect
│       ├── EndingScene.tsx       # Closing sequence
│       └── Watermark.tsx         # Channel watermark
├── tools/
│   ├── auto-server.mjs     # 🔧 API server (download, clip, analyze)
│   ├── dev.mjs              # 🚀 Dev launcher (3 services)
│   └── ui/                  # 🖥️ Editing UI (Vite + React)
└── scripts/
    ├── build-config.mjs     # YAML → TypeScript config generator
    └── switch-project.mjs   # Multi-project switcher
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev environment (Remotion Studio + API Server + Editing UI)
npm run dev
```

Three services spin up:

| Service | Port | Description |
|---------|------|-------------|
| Remotion Studio | `3000` | Live preview & render |
| Auto Server | `3456` | Download, clip, analyze API |
| Editing UI | `5173` | Visual timeline editor |

## 🎬 Video Timeline

Each video follows this structure (times are for reference, actual durations come from `project.yaml` + rank YAML files):

```
0s ──── Intro (开场标题) ──────────────────────────── ~2s
        ├── Title text animation (titleLine1 + titleLine2)
        ├── Watermark
        └── BGM starts

2s ──── #5 Rank Transition (排名转场) ────────────── ~2s
        ├── Torn paper reveal effect
        ├── Gold SVG number "5" with slide-in animation
        └── "Number Five" audio (number_5.mp3)

4s ──── #5 Gameplay (内容画面) ──────── BGM 4s beat ─ ~12-15s
   │    ├── +0.0s: Video clips start (fast-cut montage)
   │    ├── +0.4s: Brand voiceover ("Cocos Creator")
   │    ├── +0.4s: Title overlay appears (1.5s duration)
   │    ├── +1.2s: Main voiceover starts (0.8s after brand name)
   │    ├── Subtitles synced to voiceover
   │    ├── Stat number animation (synced to voiceover mention)
   │    └── Cinematic overlay + watermark throughout

~16s ── #4 Rank Transition ───────────────────────── ~2s
~18s ── #4 Gameplay ──────────────────────────────── ~12-15s
~30s ── #3 Rank Transition ───────────────────────── ~2s
~32s ── #3 Gameplay ──────────────────────────────── ~12-15s
~44s ── #2 Rank Transition ───────────────────────── ~2s
~46s ── #2 Gameplay ──────────────────────────────── ~12-15s

72s ─── #1 Rank Transition ──── BGM 72s beat ──────── ~3s
        └── Extra suspense (longer transition for #1)

75s ─── #1 Gameplay ──────────────────────────────── ~14-16s
        └── Hard cut ending (no EndingScene)
```

### BGM Beat Sync

Two mandatory sync points:
- **4s** → #5 gameplay begins (`introDuration + rankTransitionDurations[0] = 4s`)
- **72s** → #1 rank transition begins (sum of all segments before #1)

### Gameplay Internal Timeline

Within each gameplay segment:

```
0.0s ─── Video clips begin
0.4s ─── Brand voiceover starts (brand_en.mp3 [+ brand_zh.mp3 for Type A])
0.4s ─── Title overlay appears (lasts 1.5s)
         ├── Type A: EN name + 0.3s gap + ZH name
         └── Type B: single name only
~1.5s ── Brand voiceover ends
~2.3s ── Main voiceover begins (0.8s gap after brand)
         ├── Sentences separated by 0.3s gaps
         └── Stat number appears at voiceoverIndex
~end ─── Buffer before next rank transition (0.5-3s)
```



### Content (`projects/{name}/project.yaml` + `rank_*.yaml`)

**project.yaml** — Global metadata only:
```yaml
titleLine1: 全球销量
titleLine2: 前五咖啡
fps: 60
width: 1920
height: 1080

timing:
  introDuration: 2
  rankTransitionDurations: [2, 2, 2, 2, 3]  # per rank; #1 gets extra suspense
  gameplayDurations: [10, 10, 10, 10, 10]    # driven by voiceover duration
```

**rank_*.yaml** — Per-rank data (primary data source):
```yaml
rank: 5
titleEn: Nescafé
titleZh: 雀巢咖啡
clips:
  - src: nescafe/clip_001.mp4
    startFrom: 0.5
    durationSec: 1.5
```

### Style (`style.config.yaml`)

Controls fonts, colors, animation parameters, and visual effects — usually stays constant across projects.

## 📂 Multi-Project

```bash
# List all projects
npm run project -- --list

# Switch to a project (sets .current-project + rebuilds TS config)
npm run project -- game-demo
```

Or use the project selector dropdown in the Editing UI.

## 🎥 Render

```bash
# Production render
npm run build

# Fast preview render
npm run build:fast
```

## 🤖 AI Agent Integration

This project is designed to work with VS Code Copilot custom agents:

- **`@top5-video`** — Orchestrates the full pipeline: copywriting → research → TTS → clip → configure → render
- **`@content-researcher`** — Deep web research for video material
- **`@copywriter2`** — Chinese voiceover scripts in Sodabobo_ style (embedded reference)
- **`@clip-editor`** — Precise video clip selection and cutting

## 📜 License

Private project. Not for redistribution.
