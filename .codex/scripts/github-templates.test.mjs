import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const issueDirectory = ".github/ISSUE_TEMPLATE";
const issueNames = ["bug_report.md", "feature_request.md"];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

await test("IssueテンプレートをGitHubで選択でき、担当者やlabelを自動指定しない", () => {
  const files = readdirSync(join(root, issueDirectory));

  for (const name of issueNames) {
    assert.ok(files.includes(name), name);
    const template = read(`${issueDirectory}/${name}`);
    const header = template.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(header, name);
    const fields = Object.fromEntries(
      header[1].split("\n").map((line) => {
        const field = line.match(/^(\w+): (".*")$/);
        assert.ok(field, `${name}: ${line}`);

        return [field[1], JSON.parse(field[2])];
      }),
    );
    assert.ok(fields.name.trim().length > 0 && fields.about.trim().length > 0, name);
    assert.ok(!fields.labels && !fields.assignees, name);
  }
});

await test("PR本文の正本を一つに保ち、Skillsが実在するテンプレートを参照する", () => {
  const canonical = ".github/pull_request_template.md";
  assert.ok(existsSync(join(root, canonical)));

  for (const directory of [".", "docs", ".github"]) {
    const candidates = readdirSync(join(root, directory)).filter((name) =>
      /^pull_request_template(?:\.md)?$/i.test(name),
    );
    assert.deepEqual(candidates, directory === ".github" ? ["pull_request_template.md"] : []);
  }

  const resources = [
    ["create-pr", canonical],
    ...issueNames.map((name) => ["create-issue", `${issueDirectory}/${name}`]),
  ];

  for (const resource of resources) {
    assert.ok(read(`.agents/skills/${resource[0]}/SKILL.md`).includes(`../../../${resource[1]}`));
  }
});

await test("記入前のテンプレートに完了チェックや実在しない証拠を埋め込まない", () => {
  const paths = [
    ".github/pull_request_template.md",
    ...issueNames.map((name) => `${issueDirectory}/${name}`),
  ];

  for (const path of paths) {
    const body = read(path)
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    assert.doesNotMatch(body, /^\s*- \[[xX]\]/m, path);
    assert.doesNotMatch(body, /!\[[^\]]*\]\([^)]+\)|https?:\/\/|<video\b/, path);
    assert.ok(body.trim().length > 0, path);
  }
});

await test("PR・Issue評価ケースは既存Skillと利用可能な評価モードを指定する", () => {
  // ケースの形だけを確認する。投稿・録画・添付やAIの判断を実行した証拠ではない。
  const scenarios = JSON.parse(read(".codex/evals/github-scenarios.json"));
  const ids = new Set();
  const modes = new Set();

  for (const scenario of scenarios) {
    assert.match(scenario.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(!ids.has(scenario.id), scenario.id);
    ids.add(scenario.id);
    assert.ok(["draft", "publish", "blocked", "skip"].includes(scenario.mode));
    modes.add(scenario.mode);
    assert.ok(scenario.prompt.trim().length > 0);
    assert.equal(scenario.skill === null, scenario.mode === "skip");

    if (scenario.skill) {
      assert.ok(existsSync(join(root, `.agents/skills/${scenario.skill}/SKILL.md`)));
    }

    for (const field of ["fixtures", "requiredEvidence", "forbidden"]) {
      assert.ok(Array.isArray(scenario[field]) && scenario[field].length > 0);
      assert.ok(
        scenario[field].every((item) => typeof item === "string" && item.trim().length > 0),
      );
    }
  }

  assert.deepEqual(
    [...modes].sort((left, right) => left.localeCompare(right)),
    ["blocked", "draft", "publish", "skip"],
  );
});
