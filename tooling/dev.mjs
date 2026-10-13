import { spawn } from "node:child_process";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";

const apps = ["web", "business", "admin"];
// 初回だけローカル設定を用意し、開発者が既に設定した値を上書きしない。
if (!existsSync("apps/api/.dev.vars")) {
  copyFileSync("apps/api/.dev.vars.example", "apps/api/.dev.vars");
}

for (const app of apps) {
  if (!existsSync(`apps/${app}/.dev.vars`)) {
    writeFileSync(`apps/${app}/.dev.vars`, "APP_ENV=local\n");
  }
}

const spawnOptions = { stdio: "inherit", detached: process.platform !== "win32" };
const children = [
  spawn("corepack", ["pnpm", "dev:api"], spawnOptions),
  ...apps.map((app) => spawn("corepack", ["pnpm", `dev:${app}`], spawnOptions)),
];
let stopping = false;

function stop() {
  if (stopping) {
    return;
  }

  stopping = true;
  for (const child of children) {
    stopChild(child);
  }
}

function stopChild(child) {
  if (process.platform === "win32") {
    return child.kill("SIGTERM");
  }

  if (!child.pid) {
    return;
  }

  try {
    // pnpm配下のVite・Wranglerも含めて同じプロセスグループを終了する。
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// どれかのサーバーが落ちた状態で残りだけ動き続けないよう、一緒に停止する。
for (const child of children) {
  child.on("exit", (code) => {
    stop();
    process.exitCode = code ?? 1;
  });
}
