#!/usr/bin/env node
/**
 * 项目切换脚本
 *
 * 用法:
 *   node scripts/switch-project.mjs              # 交互式选择
 *   node scripts/switch-project.mjs <project-name>
 *   node scripts/switch-project.mjs --list
 *   npm run switch
 *   npm run switch game-engines
 *
 * 将活跃项目名写入 .current-project，然后运行 build-config。
 */

import {
  readdirSync,
  existsSync,
  statSync,
  writeFileSync,
  readFileSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createInterface } from "readline";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const projectsDir = resolve(root, "projects");

function getProjects() {
  if (!existsSync(projectsDir)) return [];
  return readdirSync(projectsDir).filter(
    (d) =>
      statSync(resolve(projectsDir, d)).isDirectory() &&
      existsSync(resolve(projectsDir, d, "project.yaml"))
  );
}

function getCurrentProject() {
  const f = resolve(root, ".current-project");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  return null;
}

function switchTo(name) {
  const projectYaml = resolve(projectsDir, name, "project.yaml");
  if (!existsSync(projectYaml)) {
    console.error(`Error: projects/${name}/project.yaml not found.`);
    process.exit(1);
  }
  const config = yaml.load(readFileSync(projectYaml, "utf8"));
  const template = config.template || "(default)";
  writeFileSync(resolve(root, ".current-project"), name, "utf8");
  console.log(`Switched to project: ${name}`);
  console.log(`Template: ${template}`);
  execSync("npm run config", { cwd: root, stdio: "inherit" });
}

async function interactiveSelect(projects) {
  const current = getCurrentProject();
  let selected = projects.indexOf(current);
  if (selected === -1) selected = 0;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdin.setRawMode(true);
  process.stdin.resume();

  function render() {
    process.stdout.write("\x1B[2J\x1B[H");
    console.log("Select a project (↑↓ to move, Enter to confirm, q to quit)\n");
    for (let i = 0; i < projects.length; i++) {
      const marker = projects[i] === current ? " (current)" : "";
      if (i === selected) {
        console.log(`  \x1B[36m❯ ${projects[i]}${marker}\x1B[0m`);
      } else {
        console.log(`    ${projects[i]}${marker}`);
      }
    }
  }

  render();

  return new Promise((resolve) => {
    process.stdin.on("data", (key) => {
      const k = key.toString();
      if (k === "\u001B[A") {
        selected = (selected - 1 + projects.length) % projects.length;
        render();
      } else if (k === "\u001B[B") {
        selected = (selected + 1) % projects.length;
        render();
      } else if (k === "\r" || k === "\n") {
        process.stdin.setRawMode(false);
        rl.close();
        console.log();
        resolve(projects[selected]);
      } else if (k === "q" || k === "\u0003") {
        process.stdin.setRawMode(false);
        rl.close();
        console.log("\nCancelled.");
        process.exit(0);
      }
    });
  });
}

const args = process.argv.slice(2);

if (args[0] === "--list" || args[0] === "list") {
  const projects = getProjects();
  if (projects.length === 0) {
    console.log("No projects found.");
    process.exit(0);
  }
  const current = getCurrentProject();
  console.log("Available projects:");
  for (const d of projects) {
    const mark = d === current ? "●" : "○";
    console.log(`  ${mark} ${d}`);
  }
  process.exit(0);
}

if (args.length === 0) {
  const projects = getProjects();
  if (projects.length === 0) {
    console.log("No projects found.");
    process.exit(0);
  }
  const chosen = await interactiveSelect(projects);
  switchTo(chosen);
} else {
  switchTo(args[0]);
}
