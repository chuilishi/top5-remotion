#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const active = readFileSync(resolve(root, "src/templates/active.ts"), "utf8");
const match = active.match(/activeTemplateId = "(.+?)"/);
if (!match) {
  console.error("Cannot read activeTemplateId from src/templates/active.ts");
  process.exit(1);
}
const id = match[1];
const userArgs = process.argv.slice(2);
const hasSampleRate = userArgs.some(
  (arg) => arg === "--sample-rate" || arg.startsWith("--sample-rate="),
);
const args = [
  ...userArgs,
  ...(hasSampleRate ? [] : ["--sample-rate=48000"]),
].join(" ");
const cmd = `npx remotion render ${id} ${args}`;
console.log(`> ${cmd}`);
execSync(cmd, { stdio: "inherit", cwd: root });
