#!/usr/bin/env node
/**
 * YAML → TypeScript 配置转换脚本
 *
 * 读取活跃项目的 project.yaml，生成 src/templates/active.ts，
 * 然后调用各模板的 build.mjs 钩子生成模板专属配置文件。
 *
 * 用法:
 *   node scripts/build-config.mjs
 *   npm run config
 *
 * YAML 是唯一的配置来源，生成的 .ts 文件不要手动编辑。
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
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

// ── 调用模板构建钩子 ──────────────────────────────────

const templatesDir = resolve(root, "src/templates");
const templateDirs = readdirSync(templatesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(resolve(templatesDir, d.name, "build.mjs")))
  .map((d) => d.name);

for (const dir of templateDirs) {
  const buildPath = resolve(templatesDir, dir, "build.mjs");
  const mod = await import(pathToFileURL(buildPath).href);
  const isActive = mod.templateId === template;
  await mod.buildConfig({ isActive, projectDir, projectContent: content, root });
}

console.log("\n配置生成完成！");
