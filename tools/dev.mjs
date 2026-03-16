#!/usr/bin/env node
import { spawn, execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const isWin = process.platform === "win32";

const children = [];

function launch(cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
  children.push(child);
  return child;
}

function killAll() {
  for (const child of children) {
    if (!child.pid) continue;
    try {
      if (isWin) {
        execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    } catch {}
  }
}

launch("node", ["tools/auto-server.mjs"], root);
launch("npx", ["remotion", "studio"], root);
launch("npx", ["vite", "--open"], join(root, "tools", "ui"));

process.on("SIGINT", () => { killAll(); process.exit(); });
process.on("SIGTERM", () => { killAll(); process.exit(); });
process.on("exit", killAll);
