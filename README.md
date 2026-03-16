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
├── content.config.yaml      # 📝 Content: titles, ranks, clips, subtitles
├── style.config.yaml        # 🎨 Style: fonts, colors, animation params
├── projects/                # 📂 Multi-project support
│   └── game-demo/
│       └── content.config.yaml
├── src/
│   ├── Top5Video.tsx        # 🎬 Main composition
│   └── components/
│       ├── IntroScene.tsx       # Opening title sequence
│       ├── GameTitleCard.tsx     # Rank title card with ambient glow
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

## 📝 Configuration

### Content (`content.config.yaml`)

```yaml
titleLine1: 全球销量
titleLine2: 前五咖啡
fps: 60
width: 1920
height: 1080

timing:
  introDuration: 2
  rankTransitionDuration: 2
  titleCardDuration: 1.5
  gameplayDurations: [12, 12, 12, 12, 14]  # per rank, #1 gets more time

games:
  - rank: 5
    titleEn: Nescafé
    titleZh: 雀巢咖啡
    bgColor: "#8B4513"    # ambient glow color
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

# Switch to a project (copies YAML + rebuilds TS config)
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

- **`@top5-video`** — Orchestrates the full pipeline: research → download → clip → configure → render
- **`@content-researcher`** — Deep web research for content, facts, and video material

## 📜 License

Private project. Not for redistribution.
