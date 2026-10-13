import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`可読性の空行: ${name}`, run);
RuleTester.it = (name, run) => it(`処理の区切りを検査する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`処理の区切りを検査する: ${name}`, run);

const tester = new RuleTester({ cwd: "/repository" });
const filename = "apps/api/src/application/order/example.ts";

tester.run("project/readable-spacing", plugin.rules["readable-spacing"], {
  valid: [
    { filename, code: 'import { a } from "a";\nimport { b } from "b";\n\nconst value = a + b;' },
    { filename, code: "class Example {\n  first() {}\n\n  second() {}\n}" },
    {
      filename,
      code: "function run() {\n  const value = read();\n  if (!value) { return; }\n\n  save(value);\n}",
    },
    {
      filename,
      code: "const ExampleDto = schema.brand();\nexport type ExampleDto = z.infer<typeof ExampleDto>;",
    },
    { filename, code: "function run() { if (ready) { save(); } else { stop(); } }" },
    { filename, code: "class Example {\n  first = 1;\n  second = 2;\n}" },
    { filename, code: 'import { a } from "a";\n\n/** Implementation. */\nconst value = a;' },
  ],
  invalid: [
    {
      code: 'import { a } from "a";\nconst value = a;',
      output: 'import { a } from "a";\n\nconst value = a;',
    },
    {
      code: "class Example {\n  first() {}\n  second() {}\n}",
      output: "class Example {\n  first() {}\n\n  second() {}\n}",
    },
    {
      code: "class Example {\n  value = 1;\n  constructor() {}\n}",
      output: "class Example {\n  value = 1;\n\n  constructor() {}\n}",
    },
    {
      code: "function first() {}\nfunction second() {}",
      output: "function first() {}\n\nfunction second() {}",
    },
    {
      code: "export type First = string;\nexport const next = 1;",
      output: "export type First = string;\n\nexport const next = 1;",
    },
    {
      code: "function run() {\n  if (!ready) { return; }\n  save();\n}",
      output: "function run() {\n  if (!ready) { return; }\n\n  save();\n}",
    },
    {
      code: 'import { a } from "a";\n/** Implementation. */\nconst value = a;',
      output: 'import { a } from "a";\n\n/** Implementation. */\nconst value = a;',
    },
    {
      code: "function first() {} // Keep this comment.\nfunction second() {}",
      output: "function first() {} // Keep this comment.\n\nfunction second() {}",
    },
    {
      code: "function run() { if (!ready) { return; } save(); }",
      output: "function run() { if (!ready) { return; } \n\nsave(); }",
    },
  ].map((example) => ({ filename, ...example, errors: [{ messageId: "blankLine" }] })),
});
