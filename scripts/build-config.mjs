#!/usr/bin/env node
/**
 * 项目配置准备脚本（模板无关）
 *
 * 读取活跃项目的 YAML 文件，生成:
 *   1. src/templates/active.ts — 当前模板 ID
 *   2. public/_active/project.json — project.yaml 原文
 *   3. public/_active/ranks/*.json — 每个 rank YAML 单独转为 JSON（如果有）
 *
 * 不做任何模板特定的计算或合并。
 * 各模板的 calculateMetadata 运行时自行 fetch 所需数据。
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

console.log("\n配置生成完成！");
