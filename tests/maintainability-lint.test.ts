// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { expect, it } from "vite-plus/test";
import {
  lintRegressions,
  lintRegressionControls,
  lintReviewRegressions,
  lintReviewControls,
  lintEmptyConditionalControl,
} from "@/tests/fixtures/lint-regression-fixtures.ts";

const COMMAND_TIMEOUT_MS = 30_000;
const fixtures = {
  "source.ts": "void 0;\n".repeat(301),
  "within.test.ts": "void 0;\n".repeat(600),
  "over.spec.ts": "void 0;\n".repeat(601),
  "comments.ts": "// comment\n\n".repeat(400) + "void 0;\n",
  "function.ts": `export function long(count: number) {
${"count += 1;\n".repeat(51)}return count;
}`,
  "complex.ts": `export function complex(value: number) {
${Array.from({ length: 11 }, (_, index) => `if (value === ${index}) { return ${index}; }\n`).join("\n")}
return value;
}`,
  "depth.ts":
    "export function nested(a: boolean) { if(a){if(a){if(a){if(a){return 1;}}}}\n\nreturn 0; }",
};

interface LintDiagnostic {
  filename: string;
  code: string;
  severity: string;
}

// 実CLIでオーバーライドと計数を確認し、設定に書くだけで効かない状態への退行を防ぐ。
it(
  "行数・複雑度は警告し、深度はエラーにして、テストの600行・空行コメント除外を適用する",
  () => {
    const result = lintFixtures(fixtures);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(
      diagnostics
        .filter((props) => props.code === "eslint(max-depth)")
        .every((props) => props.severity === "error"),
    ).toBe(true);
    expect(
      diagnostics
        .filter((props) => props.code !== "eslint(max-depth)")
        .every((props) => props.severity === "warning"),
    ).toBe(true);
    const findings = diagnostics.map((props) => [basename(props.filename), props.code]);
    expect(findings.sort((props, inputProps) => props[0]!.localeCompare(inputProps[0]!))).toEqual([
      ["complex.ts", "eslint(complexity)"],
      ["depth.ts", "eslint(max-depth)"],
      ["function.ts", "eslint(max-lines-per-function)"],
      ["over.spec.ts", "eslint(max-lines)"],
      ["source.ts", "eslint(max-lines)"],
    ]);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "条件型由来のneverをEntity検査で許可し、冗長なunionの警告は維持する",
  () => {
    const result = lintFixtures(lintEmptyConditionalControl);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(diagnostics.map((item) => item.code)).toEqual([
      "typescript(no-redundant-type-constituents)",
    ]);
    expect(diagnostics.every((item) => item.severity === "warning")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

function lintFixtures(sources: Record<string, string>) {
  const directory = mkdtempSync(join(process.cwd(), ".lint-sizing-probe-"));
  try {
    for (const [name, contents] of Object.entries(sources)) {
      const path = join(directory, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    return spawnSync("corepack", ["pnpm", "exec", "vp", "lint", directory, "--format", "json"], {
      encoding: "utf8",
      timeout: COMMAND_TIMEOUT_MS,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it(
  "lintルールの責務分割後も依存境界・コンポーネント数・ブランド型を拒否する",
  () => {
    const result = lintFixtures({
      "apps/demo/src/other.ts": "export const x = 1;",
      "apps/demo/src/import.ts": 'export { x } from "./other.ts";',
      "apps/demo/src/components.tsx":
        "export function First() { return null; }\n\nexport function Second() { return null; }",
      "apps/api/src/domain/demo/value-objects/amount.ts": "export type Amount = string;",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    const rules = diagnostics
      .map((props) => props.code)
      .sort((left, right) => left.localeCompare(right));
    expect(rules).toEqual([
      "project(no-relative-imports)",
      "project(one-component-per-file)",
      "project(single-value-object)",
      "project(single-value-object)",
    ]);
    expect(diagnostics.every((props) => props.severity === "error")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

const resolveClientImport = createRequire(
  new URL("../packages/client/package.json", import.meta.url),
).resolve;
it.each(["#client/shared/i18n/en-access.ts", "#client/_app/providers/data-providers.tsx"])(
  "拡張子付き内部import %sをNode標準で解決する",
  (specifier) => {
    expect(resolveClientImport(specifier)).toBe(
      fileURLToPath(
        new URL(`../packages/client/src/${specifier.slice("#client/".length)}`, import.meta.url),
      ),
    );
  },
);

it("TSXではコンポーネント300行と通常の関数50行を区別する", () => {
  const body = (lines: number) => "void 0;\n".repeat(lines);
  const result = lintFixtures({
    "component.tsx": `export function Screen() {\n${body(198)}return null;\n}`,
    "wrapped.tsx": `import { memo, forwardRef } from "react";\n\nexport const Screen = memo(forwardRef(() => {\n${body(198)}return null;\n}));`,
    "default.tsx": `export default () => {\n${body(198)}return null;\n};`,
    "boundary.tsx": `export function Screen() {\n${body(297)}return null;\n}`,
    "within-helper.tsx": `export function useExample() {\n${body(47)}return null;\n}`,
    "over-component.tsx": `export function Screen() {\n${body(299)}return null;\n}`,
    "helper.tsx": `export function useExample() {\n${body(49)}return null;\n}`,
    "nested.tsx": `export function Screen() {\nconst onClick = () => {\n${body(49)}return null;\n};\nreturn onClick();\n}`,
    "comments.tsx": `export const Screen = () => {\n${"/* comment\ncomment */\n\n".repeat(200)}return null;\n};`,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
  const functions = diagnostics.filter((props) => props.code === "project(react-function-lines)");
  expect(functions.map((props) => basename(props.filename)).sort()).toEqual([
    "helper.tsx",
    "nested.tsx",
    "over-component.tsx",
  ]);
  expect(diagnostics.every((props) => props.severity === "warning")).toBe(true);
});

it("Vite Plusで空行・波括弧・三項演算子・コールバックの違反がエラーになる", () => {
  const callbacks = (depth: number) => "[1].map(() => ".repeat(depth) + "0" + ")".repeat(depth);
  const result = lintFixtures({
    "spacing.ts": "export function first() {}\nexport function second() {}",
    "curly.ts": "export function run(value: boolean) { if (value) void 0; }",
    "ternary.ts": "export function run(a: boolean, b: boolean) { return a ? b ? 1 : 2 : 3; }",
    "callbacks.ts": `export const result = ${callbacks(3)};`,
    "callbacks.test.ts": `export const result = ${callbacks(4)};`,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(1);
  const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
  expect(diagnostics.map((props) => props.code).sort()).toEqual([
    "eslint(curly)",
    "eslint(max-nested-callbacks)",
    "eslint(no-nested-ternary)",
    "project(readable-spacing)",
  ]);
  expect(diagnostics.every((props) => props.severity === "error")).toBe(true);
  expect(diagnostics.some((props) => basename(props.filename) === "callbacks.test.ts")).toBe(false);
});

it(
  "antfuを参考にしたimport規約を実CLIでエラーとして検査する",
  () => {
    const result = lintFixtures({
      "first.ts": 'void 0;\nimport "react";\n',
      "duplicate.ts":
        'import { useState } from "react";\nimport { useRef } from "react";\n\nvoid [useState, useRef];\n',
      "type.ts":
        'import { type ReactNode } from "react";\n\nexport type FileReactNode = ReactNode;\n',
      "valid.ts":
        '"use client";\nimport { useState } from "react";\nimport type { ReactNode } from "react";\n\nvoid useState;\n\nexport type FileReactNode = ReactNode;\n',
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(diagnostics.map((props) => props.code).sort()).toEqual([
      "import(consistent-type-specifier-style)",
      "import(first)",
      "import(no-duplicates)",
    ]);
    expect(diagnostics.every((props) => props.severity === "error")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "バグ防止・不要コード・不要な抑制コメントを実CLIでエラーにする",
  () => {
    const result = lintFixtures({
      "array.js": "[1].map((value) => { void value; });\n",
      "promise.js": "void new Promise(async (resolve) => { resolve(1); });\n",
      "switch.js":
        "export function check(value) { switch (value) { case 1: value++; case 2: return value; } }\n",
      "catch.js":
        "export function check(operation) { try { return operation(); } catch (error) { throw error; } }\n",
      "return.js": "export function check() { return; }\n",
      "const.js": "let value = 1;\nvoid value;\n",
      "ternary.js": "export function check(value) { return value ? true : false; }\n",
      "disable.js": "// oxlint-disable-next-line no-debugger\nvoid 0;\n",
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(
      diagnostics
        .filter((props) => basename(props.filename) !== "disable.js")
        .map((props) => props.code)
        .sort(),
    ).toEqual([
      "eslint(array-callback-return)",
      "eslint(no-async-promise-executor)",
      "eslint(no-fallthrough)",
      "eslint(no-unneeded-ternary)",
      "eslint(no-useless-catch)",
      "eslint(no-useless-return)",
      "eslint(prefer-const)",
    ]);
    expect(diagnostics.filter((props) => basename(props.filename) === "disable.js")).toHaveLength(
      1,
    );
    expect(diagnostics.every((props) => props.severity === "error")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "クラス宣言・匿名クラス式とテストにも1ファイル1クラスを適用する",
  () => {
    const result = lintFixtures({
      "multiple.ts": "export class First {}\n\nexport class Second {}\n",
      "expressions.ts": "export const First = class {};\nexport const Second = class {};\n",
      "fixture.test.ts": "export class First {}\n\nexport class Second {}\n",
      "single.ts": "export class Single {}\n\nexport type State = string;\n",
      "one.ts": "export class First {}\n",
      "two.ts": "export class Second {}\n",
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(
      diagnostics
        .map((props) => [basename(props.filename), props.code])
        .sort((props, inputProps) => props[0]!.localeCompare(inputProps[0]!)),
    ).toEqual([
      ["expressions.ts", "eslint(max-classes-per-file)"],
      ["fixture.test.ts", "eslint(max-classes-per-file)"],
      ["multiple.ts", "eslint(max-classes-per-file)"],
    ]);
    expect(diagnostics.every((props) => props.severity === "error")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "Entityはクラス、VO・DTOはブランド型の規約を実CLIで検査する",
  () => {
    const result = lintFixtures({
      "apps/api/src/domain/demo/entities/order-line.ts":
        "export type OrderLine = Readonly<{sku: string}>;\n",
      "apps/api/src/domain/demo/entities/product.ts":
        "export class InvalidProductError extends Error {}\n",
      "apps/api/src/domain/demo/value-objects/amount.ts": "export const Amount = class {};\n",
      "apps/api/src/application/demo/dtos/example-dto.ts": "export class ExampleDto {}\n",
      "apps/api/src/domain/demo/entities/organization.ts": "export class OrganizationEntity {}\n",
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(diagnostics.map((props) => props.code).sort()).toEqual([
      "project(branded-dto)",
      "project(entity-class)",
      "project(entity-class)",
      "project(single-value-object)",
    ]);
    expect(diagnostics.every((props) => props.severity === "error")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "1ファイル1VO・1DTOを実CLIでエラーにする",
  () => {
    const pair =
      'const First = z.string().brand<"First">(); export type First = z.output<typeof First>;\n\nconst Second = z.string().brand<"Second">(); export type Second = z.output<typeof Second>;\n';
    const result = lintFixtures({
      "apps/api/src/domain/demo/value-objects/example.ts": 'import {z} from "zod";\n\n' + pair,
      "apps/api/src/application/demo/dtos/example.ts":
        'import {z} from "zod";\n\nexport const First = z.string().brand<"First">(); export type First = z.infer<typeof First>;\n\nexport const Second = z.string().brand<"Second">(); export type Second = z.infer<typeof Second>;\n',
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(diagnostics.map((props) => props.code).sort()).toEqual([
      "project(one-dto-per-file)",
      "project(one-value-object-per-file)",
    ]);
    expect(diagnostics.every((props) => props.severity === "error")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "実CLIで引数の分割代入をエラーにし、変数宣言の分割代入は許可する",
  () => {
    const result = lintFixtures({
      "object.ts": "export function title({ title }: { title: string }) { return title; }",
      "array.ts": "export const first = ([value]: string[]) => value;",
      "allowed.ts":
        "export function title(props: {title: string}) { const {title} = props; return title; }",
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    const findings = diagnostics.filter(
      (diagnostic) => diagnostic.code === "project(no-destructured-parameters)",
    );
    expect(findings).toHaveLength(2);
    expect(findings.every((diagnostic) => diagnostic.severity === "error")).toBe(true);
    expect(findings.map((diagnostic) => basename(diagnostic.filename)).sort()).toEqual([
      "array.ts",
      "object.ts",
    ]);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "実CLIでapplicationのService名・配置違反をエラーにする",
  () => {
    const result = lintFixtures({
      "apps/api/src/application/demo/providers/account-service.ts":
        "export class AccountService {}",
      "apps/api/src/application/demo/shared/example-use-case.ts": "export class ExampleUseCase {}",
      "apps/api/src/application/demo/use-cases/helper.ts": "export function helper() {}",
      "apps/api/src/application/demo/policies/example-policy.ts": "export class ExamplePolicy {}",
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    const findings = diagnostics.filter(
      (diagnostic) => diagnostic.code === "project(application-roles)",
    );
    expect(findings).toHaveLength(3);
    expect(findings.every((diagnostic) => diagnostic.severity === "error")).toBe(true);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "Issue #52のEntity型・匿名クラス・UseCase実体の検出漏れを実CLIで拒否する",
  () => {
    const result = lintFixtures(lintRegressions);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    const findings = diagnostics.filter((item) =>
      ["project(entity-class)", "project(application-roles)"].includes(item.code),
    );
    expect(findings).toHaveLength(6);
    expect(findings.every((item) => item.severity === "error")).toBe(true);
    const relative = findings.map((item) => item.filename.slice(item.filename.indexOf("apps/")));
    expect(relative.sort()).toEqual(Object.keys(lintRegressions).sort());
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "Issue #52の対照となるEntity由来型・正常配置・テスト用ファイルを実CLIで許可する",
  () => {
    const result = lintFixtures(lintRegressionControls);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(diagnostics).toEqual([]);
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "PR #53の公開型の検査抜け・ambientクラスを実CLIで拒否する",
  () => {
    const result = lintFixtures(lintReviewRegressions);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(diagnostics, JSON.stringify(diagnostics)).toHaveLength(
      Object.keys(lintReviewRegressions).length,
    );
    expect(diagnostics.every((item) => item.severity === "error")).toBe(true);
    const paths = diagnostics.map((item) => item.filename.slice(item.filename.indexOf("apps/")));
    expect(paths.sort()).toEqual(Object.keys(lintReviewRegressions).sort());
  },
  COMMAND_TIMEOUT_MS,
);

it(
  "PR #53の正常なEntity型・DTO／VO・default exportを実CLIで許可する",
  () => {
    const result = lintFixtures(lintReviewControls);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: LintDiagnostic[] };
    expect(diagnostics).toEqual([]);
  },
  COMMAND_TIMEOUT_MS,
);
