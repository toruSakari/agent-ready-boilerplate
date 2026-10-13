import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));

function fixture(t) {
  // 空白を含む作業パスも使い、hookの引用符とルート解決が壊れていないか確認する。
  const dir = mkdtempSync(join(tmpdir(), "codex harness "));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "pnpm"),
    '#!/bin/sh\n[ "$1" = "check" ] || exit 99\necho "quality result"\nexit "${CHECK_STATUS:-0}"\n',
    { mode: 0o755 },
  );
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  // 利用者のGit設定で結果が変わらないよう、fixtureだけで設定を完結させる。
  env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_CONFIG_NOSYSTEM = "1";
  assert.equal(spawnSync("git", ["init", dir], { env }).status, 0);
  mkdirSync(join(dir, "nested"));
  return { dir, env };
}

function stop(f, active = false, status = "0") {
  return spawnSync(process.execPath, [join(root, ".codex/scripts/codex-stop.mjs")], {
    cwd: join(f.dir, "nested"),
    env: { ...f.env, CHECK_STATUS: status },
    input: JSON.stringify({ cwd: join(f.dir, "nested"), stop_hook_active: active }),
    encoding: "utf8",
  });
}

await test("空白を含む下位作業ディレクトリでも、検証が通ればStopは成功する", (t) => {
  const result = stop(fixture(t));
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

await test("検証に失敗したStopは診断出力付きのブロック用JSONを返す", (t) => {
  const result = stop(fixture(t), false, "1");
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /quality result/);
});

await test("再開後のStopは再びブロックしない", (t) => {
  const result = stop(fixture(t), true, "1");
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, undefined);
  assert.match(output.systemMessage, /pnpm check/);
});

await test("Gitのpre-commitは検証の失敗を終了コードに反映する", (t) => {
  const f = fixture(t);
  const result = spawnSync("sh", [join(root, ".githooks/pre-commit")], {
    cwd: join(f.dir, "nested"),
    env: { ...f.env, CHECK_STATUS: "1" },
  });
  assert.equal(result.status, 1);
});

await test("フックの設定処理は再実行でき、既存のフックパスを保持する", (t) => {
  const f = fixture(t);
  const install = () =>
    spawnSync(process.execPath, [join(root, ".codex/scripts/setup-hooks.mjs")], {
      cwd: f.dir,
      env: f.env,
      encoding: "utf8",
    });
  const config = (...args) =>
    spawnSync("git", ["config", ...args], {
      cwd: f.dir,
      env: f.env,
      encoding: "utf8",
    });
  assert.equal(install().status, 0);
  assert.equal(install().status, 0);
  assert.equal(config("--get", "core.hooksPath").stdout.trim(), ".githooks");
  assert.equal(config("--local", "core.hooksPath", "custom-hooks").status, 0);
  assert.equal(install().status, 1);
  assert.equal(config("--get", "core.hooksPath").stdout.trim(), "custom-hooks");
});

await test("設定済みフックコマンドは空白を含む下位ディレクトリから実行できる", (t) => {
  const f = fixture(t);
  mkdirSync(join(f.dir, ".codex/scripts"), { recursive: true });
  writeFileSync(
    join(f.dir, ".codex/scripts/codex-stop.mjs"),
    readFileSync(join(root, ".codex/scripts/codex-stop.mjs")),
  );
  const config = JSON.parse(readFileSync(join(root, ".codex/hooks.json"), "utf8"));
  const handler = config.hooks.Stop[0].hooks[0];
  assert.equal(handler.type, "command");
  const result = spawnSync("sh", ["-c", handler.command], {
    cwd: join(f.dir, "nested"),
    env: { ...f.env, CHECK_STATUS: "1" },
    input: JSON.stringify({ cwd: join(f.dir, "nested"), stop_hook_active: false }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).decision, "block");
});
