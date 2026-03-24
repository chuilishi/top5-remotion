#!/usr/bin/env node
/**
 * YAML → TypeScript 配置转换脚本
 *
 * 读取活跃项目的 project.yaml + rank_*.yaml + 根目录 style.config.yaml，
 * 生成 src/config/ 下的 .ts 配置文件。
 *
 * 用法:
 *   node scripts/build-config.mjs
 *   npm run config
 *
 * YAML 是唯一的配置来源，生成的 .ts 文件不要手动编辑。
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const PRE_FINAL_BEAT_SEC = 72;
const MIN_TAIL_BUFFER_SEC = 0.3;
const BUFFER_WARN_HIGH_SEC = 1.5;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── 确定活跃项目 ──────────────────────────────────────

const currentProjectFile = resolve(root, ".current-project");
if (!existsSync(currentProjectFile)) {
  console.error("Error: No active project. Run: npm run project -- <name>");
  process.exit(1);
}
const currentProject = readFileSync(currentProjectFile, "utf8").trim();
const projectDir = resolve(root, "projects", currentProject);

// ── 读取项目头部配置 ──────────────────────────────────

const projectYamlPath = resolve(projectDir, "project.yaml");
if (!existsSync(projectYamlPath)) {
  console.error(`Error: projects/${currentProject}/project.yaml not found.`);
  process.exit(1);
}
const content = yaml.load(readFileSync(projectYamlPath, "utf8"));

// ── 读取 style.config.yaml ───────────────────────────

const styleYaml = readFileSync(resolve(root, "style.config.yaml"), "utf8");
const style = yaml.load(styleYaml);

// ── 从 rank_*.yaml 组装 games 数组 ─────────────────────

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
    gameplayDurations[adjustableCount] += avg;
  }

  content.timing.gameplayDurations = gameplayDurations;
} else {
  content.games = content.games || [];
}

// ── 后处理: YAML 不支持 Infinity，用大数代替 ───────────

if (style.titleCard?.fontSizeBreakpoints) {
  style.titleCard.fontSizeBreakpoints = style.titleCard.fontSizeBreakpoints.map(
    ([limit, ratio, max]) => [limit >= 999999 ? Infinity : limit, ratio, max]
  );
}

// ── 生成 content.config.ts ─────────────────────────────

const contentTs = `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
// ⚠️ 请勿手动编辑 — 修改 project.yaml 或 rank_*.yaml 后运行 npm run config
//
// 生成时间: ${new Date().toISOString()}

import type { ContentConfig } from "./types";

const contentConfig: ContentConfig = ${JSON.stringify(content, null, 2)};

export default contentConfig;
`;

// ── 生成 style.config.ts ───────────────────────────────

// Infinity 需要特殊处理: JSON.stringify 会变成 null
const styleJson = JSON.stringify(style, (key, val) => {
  if (val === Infinity) return "__INFINITY__";
  return val;
}, 2).replace(/"__INFINITY__"/g, "Infinity");

const styleTs = `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
// ⚠️ 请勿手动编辑 — 修改 style.config.yaml 后运行 npm run config
//
// 生成时间: ${new Date().toISOString()}

import type { StyleConfig } from "./types";

const styleConfig: StyleConfig = ${styleJson};

export default styleConfig;
`;

// ── 写入 ────────────────────────────────────────────────

const configDir = resolve(root, "src/config");

writeFileSync(resolve(configDir, "content.config.ts"), contentTs, "utf8");
console.log("✅ src/config/content.config.ts");

writeFileSync(resolve(configDir, "style.config.ts"), styleTs, "utf8");
console.log("✅ src/config/style.config.ts");

console.log("\\n配置生成完成！");
