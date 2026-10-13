// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const COMMAND_TIMEOUT_MS = 30_000;

// Viteの変換に依存せず、Oxlintと同じNodeのネイティブimportで全モジュールを読む。
it("TypeScriptのLintプラグインを事前ビルドなしで読み込む", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
    import plugin from "./lint/no-relative-imports.ts";
    process.stdout.write(JSON.stringify({ name: plugin.meta.name, rules: Object.keys(plugin.rules) }));
  `,
    ],
    { cwd: root, encoding: "utf8", timeout: COMMAND_TIMEOUT_MS },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  const plugin = JSON.parse(result.stdout) as { name: string; rules: string[] };
  expect(plugin.name).toBe("project");
  expect(plugin.rules).toHaveLength(12);
  expect(plugin.rules).toContain("entity-class");
});

it("Lint実装の厳密な型とNodeで除去可能な構文を検査する", () => {
  const result = spawnSync(
    process.execPath,
    [
      join(dirname(require.resolve("typescript/package.json")), "bin/tsc"),
      "--project",
      "tooling/lint/tsconfig.json",
      "--pretty",
      "false",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: COMMAND_TIMEOUT_MS,
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
