## Project Overview

Remotion-based multi-template video generation tool. Produces countdown-style "Top 5" videos and other formats. Data-driven: YAML configs → automated build pipeline → rendered MP4.

## Architecture

- **Multi-template system**: Each project declares `template` in `project.yaml`, mapped to a Remotion `<Composition>` in `Root.tsx`
- **Data flow**: YAML → `npm run config` → `public/_active/content.json` → `calculateMetadata` (runtime) → component props
- **Local Remotion build**: All Remotion packages built from `remotion-src/` monorepo with NVENC/CUDA patches. Installed via `file:remotion-local/*.tgz` + overrides in package.json

## Key Commands

```bash
npm run project -- <name>   # Switch project (auto-runs config)
npm run config              # YAML → TypeScript config (required after YAML changes)
npm run start               # Remotion Studio preview
npm run dev                 # Full dev (Studio + API Server + clip UI)
npm run build               # Final render
uv run tts_gen.py --batch <file.json>  # Fish Audio TTS batch
```

## File Map

| Path | Purpose |
|------|---------|
| `projects/{name}/project.yaml` | Project metadata + template selection |
| `projects/{name}/rank_*.yaml` | Top5 rank data (clips, subtitles, stats) |
| `public/{folder}/` | Video clips + audio files per project |
| `scripts/build-config.mjs` | YAML → active.ts + content.json |
| `scripts/switch-project.mjs` | Switch active project |
| `src/Root.tsx` | Composition registry |
| `src/templates/active.ts` | **Auto-generated** — do NOT edit |
| `src/templates/top5/` | Top5Video template components |
| `src/templates/gaoshou-ru-yun/` | GaoShouRuYun template |
| `public/_active/` | **Auto-generated** — do NOT edit |
| `remotion-src/` | Patched Remotion source (NVENC, GPU rasterization) |
| `remotion-local/*.tgz` | Built Remotion tarballs |

## Agent Workflow

Agents in `.github/agents/` coordinate video production:
- `@top5-video` — orchestrator
- `@copywriter` — Chinese voiceover scripts (Sodabobo_ style)
- `@material-researcher` — video footage scouting
- `@clip-editor` — precise clip selection + cutting

## Code Conventions

- fps = 60
- Use `<OffthreadVideo>` with `volume={0}` for video clips
- Use `staticFile()` for public/ assets
- Animations: `useCurrentFrame()` + `interpolate()`, no CSS transitions
- All UI text in Chinese
- TTS speed: 7.3 chars/sec (Fish Audio, speed=1.3, atempo=1.1)
- YAML is the single source of truth for project data

## Common Tasks

### Adding a new project
1. Create `projects/<name>/project.yaml` with `template: <CompositionId>`
2. Create rank YAML files if using Top5 template
3. `npm run project -- <name>`

### Adding a new template
1. Create `src/templates/<name>/` with components + schema + index.ts
2. Register `<Composition>` in `src/Root.tsx`
3. Create project YAML pointing to new template

### Rebuilding Remotion (after source changes)
```bash
cd remotion-src && bun install && npx turbo run make --filter="@remotion/cli..."
cd .. && powershell -File remotion-local/repack.ps1
npm install
```
