# Remotion official docs snapshot

This directory is a local snapshot of Remotion documentation from:

- Source: `remotion-src/packages/docs`
- Version: `v4.0.470`
- Commit: `4823e31b15`
- Synced docs tree: `docs/`
- Synced sidebar metadata: `sidebars.ts`

The files are kept in their upstream MDX/TSX form so agents can search them with `rg` and compare them against the local patched Remotion source.

To refresh after updating `remotion-src`, mirror:

```powershell
remotion-src/packages/docs/docs -> docs/remotion-official/docs
remotion-src/packages/docs/sidebars.ts -> docs/remotion-official/sidebars.ts
```
