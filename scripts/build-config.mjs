#!/usr/bin/env node
/**
 * YAML → TypeScript 配置转换脚本
 *
 * 读取项目根目录的 YAML 配置文件，生成 src/config/ 下的 .ts 配置文件。
 *
 * 用法:
 *   node scripts/build-config.mjs
 *   npm run config
 *
 * YAML 是唯一的配置来源，生成的 .ts 文件不要手动编辑。
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── 读取 YAML ──────────────────────────────────────────

const contentYaml = readFileSync(resolve(root, "content.config.yaml"), "utf8");
const styleYaml = readFileSync(resolve(root, "style.config.yaml"), "utf8");

const content = yaml.load(contentYaml);
const style = yaml.load(styleYaml);

// ── 后处理: YAML 不支持 Infinity，用大数代替 ───────────

if (style.titleCard?.fontSizeBreakpoints) {
  style.titleCard.fontSizeBreakpoints = style.titleCard.fontSizeBreakpoints.map(
    ([limit, ratio, max]) => [limit >= 999999 ? Infinity : limit, ratio, max]
  );
}

// ── 生成 content.config.ts ─────────────────────────────

const contentTs = `\
// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
// ⚠️ 请勿手动编辑 — 修改 content.config.yaml 后运行 npm run config
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
