// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

const workflows = new URL("../.github/workflows/", import.meta.url);

// 公開テンプレートのCIは検証だけに限定し、配備先の資格情報を受け取らない。
describe("公開テンプレートのCI", () => {
  it("検証用の2ワークフローだけを含む", () => {
    expect(readdirSync(workflows).sort()).toEqual(["ci.yml", "repository-boundaries.yml"]);
  });

  it.each(["ci.yml", "repository-boundaries.yml"])("%sは配備せずdraftも検証する", (name) => {
    const workflow = readFileSync(new URL(name, workflows), "utf8");
    expect(workflow).toContain("  pull_request:");
    expect(workflow).toContain("  push:\n    branches: [main]");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).not.toMatch(/pull_request_target|pull_request\.draft|secrets\.|vars\./);
    expect(workflow).not.toMatch(/pnpm (?:deploy|preview:delete|db:migrate:remote)/);
  });

  it("lint・型・単体・ハーネス・build・E2Eを検証する", () => {
    const workflow = readFileSync(new URL("ci.yml", workflows), "utf8");
    for (const command of [
      "check",
      "typecheck",
      "test:harness",
      "test",
      "build",
      "build-storybook",
      "test:e2e",
    ]) {
      expect(workflow).toContain(`run: pnpm ${command}\n`);
    }
  });

  it("アプリ切り出し後の独立検証を維持する", () => {
    const workflow = readFileSync(new URL("repository-boundaries.yml", workflows), "utf8");
    expect(workflow).toContain("app: [api, web, business, admin]");
    expect(workflow).toContain("run: pnpm repository:export");
    for (const command of ["install", "typecheck", "build", "test"]) {
      expect(workflow).toContain(`run: pnpm ${command}\n`);
    }
  });
});
