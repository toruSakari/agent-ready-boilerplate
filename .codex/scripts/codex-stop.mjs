import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const event = JSON.parse(readFileSync(0, "utf8"));
// Stopによる継続は1回まで。環境の制約で無限ループしない。
if (event.stop_hook_active) {
  console.log(
    JSON.stringify({
      systemMessage:
        "品質チェックで継続したターンです。修正後にpnpm checkを再実行し、未解決なら理由を報告してください。",
    }),
  );
} else {
  // 呼び出し元がサブディレクトリでも、同じリポジトリ全体の品質チェックを実行する。
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: event.cwd,
    encoding: "utf8",
  });
  const check =
    root.status === 0
      ? spawnSync("pnpm", ["check"], {
          cwd: root.stdout.trim(),
          encoding: "utf8",
          timeout: 150_000,
          maxBuffer: 2 * 1024 * 1024,
        })
      : root;
  if (check.status !== 0 || check.error) {
    // hook自体の異常終了ではなく、継続理由をJSONで返して修正可能な失敗として扱う。
    const output = [check.error?.message, check.stdout, check.stderr].filter(Boolean).join("\n");
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `品質チェックが失敗しました。対象の問題を修正してpnpm checkを再実行してください。環境の制約で実行できない場合は、その理由と未検証項目を報告してください。\n${output.slice(-6000)}`,
      }),
    );
  }
}
