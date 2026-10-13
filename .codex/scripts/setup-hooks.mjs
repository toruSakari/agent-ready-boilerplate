import { spawnSync } from "node:child_process";

const existing = spawnSync("git", ["config", "--get", "core.hooksPath"], { encoding: "utf8" });
if (existing.status !== 0 && existing.status !== 1) {
  console.error(existing.stderr || "Git設定を読み取れませんでした。");
  process.exit(1);
}

// 既存のhook運用を壊さないよう、別の保存先が設定済みなら利用者による統合を求める。
if (existing.status === 0 && existing.stdout.trim() !== ".githooks") {
  console.error(
    "既存のcore.hooksPathがあるため上書きしません。既存hookにpnpm checkを統合してください。",
  );
  process.exit(1);
}

const result = spawnSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
});
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Git pre-commit hookを有効にしました（pnpm check）。");
