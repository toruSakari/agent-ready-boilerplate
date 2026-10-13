import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const DISCOVERY_LIMIT_BYTES = 32 * 1024;
// 個人の指示や将来の追加分にも余地を残す。実クライアントの注入量は別途確認する。
const REPOSITORY_BUDGET_BYTES = 30 * 1024;
const skippedDirectories = new Set(["node_modules", ".git", ".wrangler", ".output", "dist"]);

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function instructionFiles(directory) {
  const found = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const path = join(directory, entry.name);

    if (entry.isDirectory() && !skippedDirectories.has(entry.name)) {
      found.push(...instructionFiles(path));
    } else if (/^AGENTS(?:\.override)?\.md$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

function instructionChain(
  files,
  directory,
  hasContent = (path) => readFileSync(path, "utf8").trim().length > 0,
) {
  const nonempty = files.filter(hasContent);
  const levels = [root];
  let current = root;

  for (const part of relative(root, directory).split(sep).filter(Boolean)) {
    current = join(current, part);
    levels.push(current);
  }

  return levels.flatMap((level) => {
    const override = join(level, "AGENTS.override.md");
    const normal = join(level, "AGENTS.md");

    return [
      nonempty.find((path) => path === override) ?? nonempty.find((path) => path === normal),
    ].filter(Boolean);
  });
}

function localLinks(sourcePath, markdown) {
  // コード例の中のリンクは操作対象にしない。外部URLの可用性はネットワークに依存させない。
  const prose = markdown.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "");
  const links = [...prose.matchAll(/\[[^\]]+\]\(([^\s)]+)\)/g)];

  return links.flatMap((match) => {
    const href = match[1];

    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("#")) {
      return [];
    }

    return [resolve(root, dirname(sourcePath), decodeURIComponent(href.split("#")[0]))];
  });
}

await test("すべてのAGENTS探索経路が既定上限内で保守用の余地を持つ", () => {
  const files = instructionFiles(root);
  assert.ok(files.includes(join(root, "apps/api/src/AGENTS.md")));

  for (const file of files) {
    const chain = instructionChain(files, dirname(file));
    const bytes = chain.reduce((total, path) => total + readFileSync(path).length + 2, 0);
    assert.ok(bytes <= REPOSITORY_BUDGET_BYTES, `${relative(root, file)}: ${bytes} bytes`);
    assert.ok(REPOSITORY_BUDGET_BYTES < DISCOVERY_LIMIT_BYTES);
  }
});

await test("同じ階層のoverrideを優先し、別の枝の指示を読み込まない", () => {
  const files = ["AGENTS.md", "apps/AGENTS.md", "apps/AGENTS.override.md", "docs/AGENTS.md"].map(
    (path) => join(root, path),
  );
  assert.deepEqual(
    instructionChain(files, join(root, "apps/api/src"), () => true),
    [join(root, "AGENTS.md"), join(root, "apps/AGENTS.override.md")],
  );
});

await test("空のoverrideは通常のAGENTSを容量計算から隠さない", () => {
  const files = ["AGENTS.md", "apps/AGENTS.md", "apps/AGENTS.override.md"].map((path) =>
    join(root, path),
  );
  const hasContent = (path) => path !== join(root, "apps/AGENTS.override.md");
  assert.deepEqual(instructionChain(files, join(root, "apps/api/src"), hasContent), [
    join(root, "AGENTS.md"),
    join(root, "apps/AGENTS.md"),
  ]);
});

const skillDirectories = readdirSync(join(root, ".agents/skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const skillFiles = skillDirectories.map((name) => `.agents/skills/${name}/SKILL.md`);

await test("Skillの名前・説明・表示プロンプトが実際の探索先と一致する", () => {
  for (const name of skillDirectories) {
    assert.match(name, /^[a-z\d]+(?:-[a-z\d]+)*$/);
    const skill = read(`.agents/skills/${name}/SKILL.md`);
    const header = skill.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(header, name);
    assert.equal(header[1].match(/^name: (.+)$/m)?.[1], name);
    assert.ok(header[1].match(/^description: (.+)$/m)?.[1].trim(), name);
    const metadata = read(`.agents/skills/${name}/agents/openai.yaml`);
    assert.ok(metadata.includes(`$${name} `), name);
  }
});

await test("入口・Skill・ガイドのローカル参照先が実在しリポジトリ内に収まる", () => {
  const paths = [
    "AGENTS.md",
    "docs/project-guide.md",
    "docs/codex-harness.md",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/bug_report.md",
    ".github/ISSUE_TEMPLATE/feature_request.md",
    "docs/adr/017-frontend-feature-ownership.md",
    ...skillFiles,
    ".agents/skills/review-code/references/review-policy.md",
  ];

  for (const path of paths) {
    for (const target of localLinks(path, read(path))) {
      assert.ok(target.startsWith(root), `${path}: ${target}`);
      assert.ok(existsSync(target), `${path}: ${relative(root, target)}`);
    }
  }
});

await test("リンク抽出は相対パスを解決し、外部URLとコード例を除外する", () => {
  const source =
    "[local](../AGENTS.md#入口) [web](https://example.com)\n```md\n[x](absent.md)\n```";
  assert.deepEqual(localLinks("docs/check.md", source), [join(root, "AGENTS.md")]);
});

await test("評価ケースは有効な起動場所とSkillを持ち、異なる適用範囲を区別する", () => {
  // ケース定義の整合性だけを検査する。Codexの起動・判断・生成物の成功を示すテストではない。
  const scenarios = JSON.parse(read(".codex/evals/bootstrap-scenarios.json"));
  const ids = new Set();
  const modes = new Set();

  for (const scenario of scenarios) {
    assert.match(scenario.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(!ids.has(scenario.id), scenario.id);
    ids.add(scenario.id);
    modes.add(scenario.mode);
    assert.ok(["design", "implementation", "clarification", "maintenance"].includes(scenario.mode));
    const cwd = resolve(root, scenario.cwd);
    assert.ok(cwd === resolve(root) || cwd.startsWith(root));
    assert.ok(existsSync(cwd), scenario.cwd);
    assert.ok(scenario.prompt.trim().length > 0);

    for (const field of ["requiredEvidence", "forbidden"]) {
      assert.ok(Array.isArray(scenario[field]) && scenario[field].length > 0);
      assert.ok(
        scenario[field].every((item) => typeof item === "string" && item.trim().length > 0),
      );
    }

    for (const skill of scenario.expectedSkills) {
      assert.ok(skillDirectories.includes(skill), skill);
    }
  }

  assert.deepEqual(
    [...modes].sort((left, right) => left.localeCompare(right)),
    ["clarification", "design", "implementation", "maintenance"],
  );
});
