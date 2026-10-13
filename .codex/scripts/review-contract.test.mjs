import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../../", import.meta.url));
const roles = ["security-reviewer", "reviewer", "solid-dry-reviewer"];
const policy = ".agents/skills/review-code/references/review-policy.md";

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const fixtures = JSON.parse(read(".codex/evals/review-fixtures.json"));
const scenarios = JSON.parse(read(".codex/evals/review-scenarios.json"));

await test("3担当は独立した名前・読み取り専用の設定と実在する共通規約を持つ", () => {
  // 必須設定の配線を確認する。TOML全構文や実クライアントでの適用は別途検証する。
  const skill = read(".agents/skills/review-code/SKILL.md");
  assert.ok(read(policy).trim().length > 0);
  const names = new Set();

  for (const role of roles) {
    const path = `.codex/agents/${role}.toml`;
    const config = read(path);
    const name = config.match(/^name = "([^"]+)"$/m)?.[1];
    assert.equal(name, role);
    assert.ok(!names.has(name), role);
    names.add(name);
    assert.match(config, /^description = ".+"$/m);
    assert.match(config, /^sandbox_mode = "read-only"$/m);
    assert.match(config, /^developer_instructions = """\n[\s\S]+\n"""$/m);
    assert.ok(config.includes(policy), role);
    assert.ok(skill.includes(`../../../${path}`), role);
  }
});

await test("raw fixtureは安全な相対パスを持ち、比較する前後に実際の差分がある", () => {
  const ids = new Set();

  for (const fixture of fixtures) {
    assert.ok(!ids.has(fixture.id), fixture.id);
    ids.add(fixture.id);
    assert.notDeepEqual(fixture.base, fixture.head, fixture.id);

    for (const field of ["base", "head", "context"]) {
      assert.ok(Object.keys(fixture[field]).length > 0, fixture.id);

      for (const [path, source] of Object.entries(fixture[field])) {
        assert.ok(!isAbsolute(path) && !path.split("/").includes(".."), path);
        assert.ok(!path.includes("\\") && !path.includes("\0"), path);
        assert.equal(typeof source, "string");
        assert.ok(source.endsWith("\n") && source.trim().length > 0, path);
      }
    }
  }
});

await test("レビュー評価は実在fixtureと既知の実行条件を持ち、採点情報を入力から分離する", () => {
  // 判断品質を実行するテストではなく、隔離した実セッションへ渡す材料の整合性を確認する。
  const modes = new Set();
  const ids = new Set();

  for (const scenario of scenarios) {
    assert.ok(!ids.has(scenario.id), scenario.id);
    ids.add(scenario.id);
    modes.add(scenario.mode);
    assert.ok(
      fixtures.some((fixture) => fixture.id === scenario.fixture),
      scenario.fixture,
    );
    assert.ok(["review", "blocked", "adjudication", "stale", "skip"].includes(scenario.mode));
    assert.ok(["available", "unavailable", "stubbed"].includes(scenario.input.subagents));
    assert.ok([".", "apps/api/src"].includes(scenario.input.cwd));
    assert.ok(scenario.input.prompt.trim().length > 0);
    assert.ok(!("requiredEvidence" in scenario.input) && !("forbidden" in scenario.input));

    for (const field of ["requiredEvidence", "forbidden"]) {
      assert.ok(Array.isArray(scenario[field]) && scenario[field].length > 0);
      assert.ok(
        scenario[field].every((item) => typeof item === "string" && item.trim().length > 0),
      );
    }
  }

  assert.deepEqual(
    [...modes].sort((left, right) => left.localeCompare(right)),
    ["adjudication", "blocked", "review", "skip", "stale"],
  );
});

function evaluateRead(source, tenantId) {
  const input = {
    actor: { tenantId },
    input: { id: "b1" },
    documents: [{ id: "b1", tenantId: "alpha", body: "fixture body" }],
  };

  // レビュー済みfixtureの回帰だけを時間制限付きで実行する。node:vmは安全な隔離ではない。
  return runInNewContext(`${source}\nreadDocument(actor, input, documents)`, input, {
    timeout: 100,
  });
}

await test("認可fixtureはbaseで他tenantを拒否しheadで漏えいする回帰を実際に持つ", () => {
  const fixture = fixtures.find((item) => item.id === "tenant-read");
  const path = "apps/api/src/application/documents/read-document.js";
  assert.equal(evaluateRead(fixture.base[path], "alpha"), "fixture body");
  assert.equal(evaluateRead(fixture.head[path], "alpha"), "fixture body");
  assert.throws(() => evaluateRead(fixture.base[path], "beta"), /not found/);
  assert.equal(evaluateRead(fixture.head[path], "beta"), "fixture body");
});

await test("命令注入fixtureもコメント以外の認可回帰を含み、指摘抑制を検証できる", () => {
  const fixture = fixtures.find((item) => item.id === "instruction-in-diff");
  const path = "apps/api/src/application/documents/read-document.js";
  assert.throws(() => evaluateRead(fixture.base[path], "beta"), /not found/);
  assert.equal(evaluateRead(fixture.head[path], "beta"), "fixture body");
});

await test("正当な境界検証fixtureは上限を維持して負数・小数の拒否を追加する", () => {
  const fixture = fixtures.find((item) => item.id === "valid-boundaries");
  const path = "apps/api/src/application/uploads/validate-size.js";
  const source = fixture.head[path];
  const evaluate = (bytes) =>
    runInNewContext(
      `${source}\nvalidateSize(bytes)`,
      { MAX_BYTES: 1048576, bytes },
      { timeout: 100 },
    );
  assert.equal(evaluate(1048576), 1048576);

  for (const bytes of [-1, 0.5, 1048577]) {
    assert.throws(() => evaluate(bytes), /invalid size/);
  }
});
