import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

export const templateId = "Top5Video";

const PRE_FINAL_BEAT_SEC = 72;
const MIN_TAIL_BUFFER_SEC = 0.3;
const BUFFER_WARN_HIGH_SEC = 1.5;
const RANK1_TAIL_BUFFER_SEC = 3.7;

function generateStyleTs(root) {
  const styleYaml = readFileSync(resolve(root, "style.config.yaml"), "utf8");
  const style = yaml.load(styleYaml);

  if (style.titleCard?.fontSizeBreakpoints) {
    style.titleCard.fontSizeBreakpoints = style.titleCard.fontSizeBreakpoints.map(
      ([limit, ratio, max]) => [limit >= 999999 ? Infinity : limit, ratio, max]
    );
  }

  const styleJson = JSON.stringify(style, (_key, val) => {
    if (val === Infinity) return "__INFINITY__";
    return val;
  }, 2).replace(/"__INFINITY__"/g, "Infinity");

  return `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
// ⚠️ 请勿手动编辑 — 修改 style.config.yaml 后运行 npm run config
//
// 生成时间: ${new Date().toISOString()}

import type { StyleConfig } from "./types";

const styleConfig: StyleConfig = ${styleJson};

export default styleConfig;
`;
}

export async function buildConfig({ isActive, projectDir, projectContent, root }) {
  const configDir = resolve(root, "src/templates/top5/config");
  const styleTs = generateStyleTs(root);

  if (!isActive) {
    const markerTs = `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
// 生成时间: ${new Date().toISOString()}

import type { ContentConfig } from "./types";

const contentConfig: ContentConfig = ${JSON.stringify(projectContent, null, 2)} as any;

export default contentConfig;
`;
    writeFileSync(resolve(configDir, "content.config.ts"), markerTs, "utf8");
    console.log("✅ src/templates/top5/config/content.config.ts (placeholder)");
    writeFileSync(resolve(configDir, "style.config.ts"), styleTs, "utf8");
    console.log("✅ src/templates/top5/config/style.config.ts");
    return;
  }

  const content = { ...projectContent };

  const rankFiles = readdirSync(projectDir)
    .filter((f) => /^rank_\d+_.+\.yaml$/.test(f))
    .sort();

  if (rankFiles.length > 0) {
    const games = rankFiles.map((f) =>
      yaml.load(readFileSync(resolve(projectDir, f), "utf8"))
    );
    games.sort((a, b) => b.rank - a.rank);
    content.games = games;

    if (!content.timing) content.timing = {};
    const existingGameplayDurations = Array.isArray(content.timing.gameplayDurations)
      ? [...content.timing.gameplayDurations]
      : [];
    const minGameplayDurations = games.map((game, i) => {
      const vo = game.voiceover;
      if (vo?.length > 0) {
        const last = vo[vo.length - 1];
        if (last.offsetSec > 0 || last.durationSec > 0) {
          return last.offsetSec + last.durationSec + MIN_TAIL_BUFFER_SEC;
        }
      }
      return existingGameplayDurations[i] ?? 20;
    });

    const gameplayDurations = [...minGameplayDurations];
    const adjustableCount = Math.max(0, games.length - 1);
    const introDuration = content.timing.introDuration ?? 2;
    const rankTransitionDurations = Array.isArray(content.timing.rankTransitionDurations)
      ? content.timing.rankTransitionDurations
      : [];

    if (adjustableCount > 0) {
      const allTransitions = rankTransitionDurations
        .reduce((sum, val) => sum + (Number(val) || 0), 0);
      const gameplayBeforeFinal = minGameplayDurations
        .slice(0, adjustableCount)
        .reduce((sum, val) => sum + val, 0);
      const remainingBuffer = PRE_FINAL_BEAT_SEC - introDuration - allTransitions - gameplayBeforeFinal;
      const avgBuffer = remainingBuffer / adjustableCount;
      const perRankBuffer = MIN_TAIL_BUFFER_SEC + Math.max(0, avgBuffer);

      if (remainingBuffer < 0) {
        console.error(
          `ERROR: ${PRE_FINAL_BEAT_SEC}s beat exceeded by ${Math.abs(remainingBuffer).toFixed(1)}s — 配音过长，精简 #5→#2 文案或缩短 rankTransitionDurations`
        );
        process.exit(1);
      }

      if (perRankBuffer > BUFFER_WARN_HIGH_SEC) {
        const excessTotal = (perRankBuffer - BUFFER_WARN_HIGH_SEC) * adjustableCount;
        console.warn(
          `Warning: per-rank buffer ${perRankBuffer.toFixed(1)}s > ${BUFFER_WARN_HIGH_SEC}s — 配音过短，画面可能空洞，建议 #5→#2 总共增加约 ${excessTotal.toFixed(1)}s 文案`
        );
      }

      const avg = remainingBuffer / adjustableCount;
      let rest = remainingBuffer;
      for (let i = 0; i < adjustableCount; i++) {
        const bonus = i === adjustableCount - 1 ? rest : avg;
        gameplayDurations[i] += bonus;
        rest -= bonus;
      }
      gameplayDurations[adjustableCount] += (RANK1_TAIL_BUFFER_SEC - MIN_TAIL_BUFFER_SEC);
    }

    content.timing.gameplayDurations = gameplayDurations;
  } else {
    content.games = content.games || [];
  }

  const contentTs = `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
// ⚠️ 请勿手动编辑 — 修改 project.yaml 或 rank_*.yaml 后运行 npm run config
//
// 生成时间: ${new Date().toISOString()}

import type { ContentConfig } from "./types";

const contentConfig: ContentConfig = ${JSON.stringify(content, null, 2)};

export default contentConfig;
`;

  writeFileSync(resolve(configDir, "content.config.ts"), contentTs, "utf8");
  console.log("✅ src/templates/top5/config/content.config.ts");

  writeFileSync(resolve(configDir, "style.config.ts"), styleTs, "utf8");
  console.log("✅ src/templates/top5/config/style.config.ts");
}
