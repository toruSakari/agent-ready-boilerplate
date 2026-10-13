// @vitest-environment node
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

describe("実SDKのserver function公開エラー境界", () => {
  it.each([
    ["get", 400, false],
    ["post", 400, false],
    ["form", 400, false],
    ["resolver", 500, false],
    ["success", 200, true],
    ["redirect", 307, true],
    ["not-found", 404, true],
    ["thrown", 500, true],
    ["returned", 500, true],
  ] as const)("%sの入力・内部例外をログと応答へ残さない", (scenario, status, invoked) => {
    const output = execFileSync(
      process.execPath,
      [fileURLToPath(new URL("./fixtures/start-handler-runner.mjs", import.meta.url)), scenario],
      { encoding: "utf8" },
    );
    const result = JSON.parse(output);
    expect(result.status).toBe(status);
    expect(result.invoked).toBe(invoked);
    expect(result.logs).toEqual([]);
    expect(result.body).not.toContain("person@example.test");
    expect(result.body).not.toContain("private_database_detail");
    expect(result.body).not.toContain("start-handler-runner");
    expect(result.body).not.toContain("server-functions-handler");
  });
});
