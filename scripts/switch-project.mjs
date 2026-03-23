#!/usr/bin/env node
/**
 * 项目切换脚本
 *
 * 用法:
 *   node scripts/switch-project.mjs <project-name>
 *   node scripts/switch-project.mjs --list
 *   npm run project -- <project-name>
 *   npm run project -- --list
 *
 * 将活跃项目名写入 .current-project，然后运行 build-config。
 */

import { readdirSync, existsSync, statSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const projectsDir = resolve(root, "projects");

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--list") {
  if (!existsSync(projectsDir)) {
    console.log("No projects/ directory found.");
    process.exit(0);
  }
  const dirs = readdirSync(projectsDir).filter((d) =>
    statSync(resolve(projectsDir, d)).isDirectory()
  );
  if (dirs.length === 0) {
    console.log("No projects found in projects/");
    process.exit(0);
  }
  console.log("Available projects:");
  for (const d of dirs) {
    const hasConfig = existsSync(resolve(projectsDir, d, "project.yaml"));
    console.log(`  ${hasConfig ? "●" : "○"} ${d}`);
  }
  process.exit(0);
}

const name = args[0];
const projectDir = resolve(projectsDir, name);
const projectYaml = resolve(projectDir, "project.yaml");

if (!existsSync(projectYaml)) {
  console.error(`Error: projects/${name}/project.yaml not found.`);
  process.exit(1);
}

writeFileSync(resolve(root, ".current-project"), name, "utf8");
console.log(`Switched to project: ${name}`);

execSync("npm run config", { cwd: root, stdio: "inherit" });
