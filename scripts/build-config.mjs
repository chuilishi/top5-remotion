#!/usr/bin/env node
/**
 * 项目配置准备脚本
 *
 * 读取活跃项目的 YAML 文件，生成:
 *   1. src/templates/active.ts — 当前模板 ID
 *   2. public/_active/content.json — 项目原始数据（无计算，运行时由 calculateMetadata 处理）
 *
 * 用法:
 *   node scripts/build-config.mjs
 *   npm run config
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
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
const content = yaml.load(readFileSync(projectYamlPath, "utf8"));

const template = content.template || "Top5Video";
console.log(`Template: ${template}`);

// ── 生成 active.ts（活跃模板标记）──────────────────────

const activeTs = `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
export const activeTemplateId = "${template}";
`;
writeFileSync(resolve(root, "src/templates/active.ts"), activeTs, "utf8");
console.log(`✅ src/templates/active.ts → ${template}`);

// ── 组装原始数据 → public/_active/content.json ────────

const rankFiles = readdirSync(projectDir)
  .filter((f) => /^rank_\d+_.+\.yaml$/.test(f))
  .sort();

if (rankFiles.length > 0) {
  const games = rankFiles.map((f) =>
    yaml.load(readFileSync(resolve(projectDir, f), "utf8"))
  );
  games.sort((a, b) => b.rank - a.rank);
  content.games = games;
} else {
  content.games = content.games || [];
}

const activeDir = resolve(root, "public/_active");
mkdirSync(activeDir, { recursive: true });
writeFileSync(resolve(activeDir, "content.json"), JSON.stringify(content, null, 2), "utf8");
console.log("✅ public/_active/content.json");

console.log("\n配置生成完成！");
