#!/usr/bin/env node
/**
 * 项目配置准备脚本
 *
 * 读取活跃项目的 YAML 文件，生成:
 *   1. src/templates/active.ts — 当前模板 ID
 *   2. public/_active/project.json — project.yaml + 模板特定计算结果
 *   3. public/_active/ranks/*.json — 每个 rank YAML 单独转为 JSON（如果有）
 *
 * 模板特定的构建逻辑（如 Top5Video 的 72s 卡点校验）在此脚本中实现，
 * Remotion 运行时直接使用预计算结果，不再重复计算。
 *
 * 新模板如需构建时计算，在 TEMPLATE_HOOKS 中注册。
 *
 * 用法:
 *   node scripts/build-config.mjs
 *   npm run config
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

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
const project = yaml.load(readFileSync(projectYamlPath, "utf8"));

const template = project.template || "Top5Video";
console.log(`Template: ${template}`);

// ── 生成 active.ts（活跃模板标记）──────────────────────

const activeTs = `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
export const activeTemplateId = "${template}";
`;
writeFileSync(resolve(root, "src/templates/active.ts"), activeTs, "utf8");
console.log(`✅ src/templates/active.ts → ${template}`);

// ── 拷贝原始数据 → public/_active/ ────────────────────

const activeDir = resolve(root, "public/_active");
rmSync(activeDir, { recursive: true, force: true });
mkdirSync(activeDir, { recursive: true });

writeFileSync(resolve(activeDir, "project.json"), JSON.stringify(project, null, 2), "utf8");
console.log("✅ public/_active/project.json");

const dataFiles = readdirSync(projectDir).filter((f) => f.endsWith(".yaml") && f !== "project.yaml");
if (dataFiles.length > 0) {
  const ranksDir = resolve(activeDir, "ranks");
  mkdirSync(ranksDir, { recursive: true });
  const rankNames = [];
  for (const f of dataFiles) {
    const data = yaml.load(readFileSync(resolve(projectDir, f), "utf8"));
    const jsonName = basename(f, ".yaml") + ".json";
    writeFileSync(resolve(ranksDir, jsonName), JSON.stringify(data, null, 2), "utf8");
    rankNames.push(jsonName);
  }
  writeFileSync(resolve(ranksDir, "index.json"), JSON.stringify(rankNames.sort()), "utf8");
  console.log(`✅ public/_active/ranks/ (${dataFiles.length} files + index.json)`);
}

// ── 模板特定构建逻辑 ─────────────────────────────────

const TEMPLATE_HOOKS = { Top5Video: buildTop5 };

if (TEMPLATE_HOOKS[template]) {
  TEMPLATE_HOOKS[template](project, dataFiles, projectDir, activeDir);
}

console.log("\n配置生成完成！");

// ── Top5Video: gameplayDurations 计算 + 卡点校验 ──

function buildTop5(proj, files, projDir, outDir) {
  const PRE_FINAL_BEAT_SEC = 72;
  const TARGET_TOTAL_SEC = 88;
  const MIN_TAIL_BUFFER_SEC = 0.3;
  const BUFFER_WARN_HIGH_SEC = 1.5;

  const RANK1_GAMEPLAY_SEC = TARGET_TOTAL_SEC - PRE_FINAL_BEAT_SEC;

  const rankFiles = files.filter((f) => /^rank_\d+_.+\.yaml$/.test(f)).sort();
  if (rankFiles.length === 0) return;

  const games = rankFiles
    .map((f) => yaml.load(readFileSync(resolve(projDir, f), "utf8")))
    .sort((a, b) => b.rank - a.rank);

  const timing = proj.timing || {};
  const introDuration = timing.introDuration ?? 2;
  const rankTransitionDurations = Array.isArray(timing.rankTransitionDurations)
    ? timing.rankTransitionDurations
    : [];

  const minGameplayDurations = games.map((game) => {
    const vo = game.voiceover;
    if (vo && vo.length > 0) {
      const last = vo[vo.length - 1];
      if (last && (last.offsetSec > 0 || last.durationSec > 0)) {
        return last.offsetSec + last.durationSec + MIN_TAIL_BUFFER_SEC;
      }
    }
    return 20;
  });

  const gameplayDurations = [...minGameplayDurations];
  const adjustableCount = Math.max(0, games.length - 1);

  if (adjustableCount > 0) {
    const allTransitions = rankTransitionDurations
      .reduce((sum, val) => sum + (Number(val) || 0), 0);
    const gameplayBeforeFinal = minGameplayDurations
      .slice(0, adjustableCount)
      .reduce((sum, val) => sum + val, 0);
    const remainingBuffer =
      PRE_FINAL_BEAT_SEC - introDuration - allTransitions - gameplayBeforeFinal;

    if (remainingBuffer < 0) {
      console.error(
        `ERROR: ${PRE_FINAL_BEAT_SEC}s beat exceeded by ${Math.abs(remainingBuffer).toFixed(1)}s`
      );
      process.exit(1);
    }

    const perRankBuffer =
      MIN_TAIL_BUFFER_SEC + Math.max(0, remainingBuffer / adjustableCount);
    if (perRankBuffer > BUFFER_WARN_HIGH_SEC) {
      const excessTotal = (perRankBuffer - BUFFER_WARN_HIGH_SEC) * adjustableCount;
      console.warn(
        `Warning: per-rank buffer ${perRankBuffer.toFixed(1)}s > ${BUFFER_WARN_HIGH_SEC}s — 配音过短，建议增加约 ${excessTotal.toFixed(1)}s 文案`
      );
    }

    const avg = remainingBuffer / adjustableCount;
    let rest = remainingBuffer;
    for (let i = 0; i < adjustableCount; i++) {
      const bonus = i === adjustableCount - 1 ? rest : avg;
      gameplayDurations[i] += bonus;
      rest -= bonus;
    }

    gameplayDurations[adjustableCount] = RANK1_GAMEPLAY_SEC;
    const rank1VoEnd = minGameplayDurations[adjustableCount] - MIN_TAIL_BUFFER_SEC;
    const rank1Tail = RANK1_GAMEPLAY_SEC - rank1VoEnd;
    if (rank1Tail < MIN_TAIL_BUFFER_SEC) {
      console.error(
        `ERROR: rank 1 voiceover (${rank1VoEnd.toFixed(1)}s) exceeds gameplay (${RANK1_GAMEPLAY_SEC}s) — 需缩短 #1 文案`
      );
      process.exit(1);
    }
  }

  if (!proj.timing) proj.timing = {};
  proj.timing.gameplayDurations = gameplayDurations;
  writeFileSync(
    resolve(outDir, "project.json"),
    JSON.stringify(proj, null, 2),
    "utf8"
  );

  const totalSec = introDuration +
    rankTransitionDurations.reduce((s, v) => s + (Number(v) || 0), 0) +
    gameplayDurations.reduce((s, v) => s + v, 0);
  console.log(
    `\n[Top5Video] gameplayDurations: ${gameplayDurations.map((d) => d.toFixed(1) + "s").join(", ")}`
  );
  console.log(
    `[Top5Video] pre-final beat: ${PRE_FINAL_BEAT_SEC}s | rank 1: ${RANK1_GAMEPLAY_SEC}s | total: ${totalSec.toFixed(1)}s / ${TARGET_TOTAL_SEC}s`
  );
}
