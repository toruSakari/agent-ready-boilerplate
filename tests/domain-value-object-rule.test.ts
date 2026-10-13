import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`単一値のブランド型: ${name}`, run);
RuleTester.it = (name, run) => it(`Value Objectの規約を検証する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`Value Objectの規約を検証する: ${name}`, run);
const tester = new RuleTester({ cwd: "/repository" });
const filename = "apps/api/src/domain/access/value-objects/example.ts";
const branded =
  'const schema = z.string().brand<"Example">(); export type Example = z.output<typeof schema>;';

tester.run("project/single-value-object", plugin.rules["single-value-object"], {
  valid: [
    { filename, code: branded },
    {
      filename,
      code: 'const schema = z.enum(["customer", "business"]).brand<"Category">(); export type Category = z.infer<typeof schema>;',
    },
    { filename: "apps/api/src/domain/access/entities/example.ts", code: "export class Entity {}" },
    {
      filename: "apps/api/src/domain/access/value-objects/example.test.ts",
      code: "class Fixture {}",
    },
    {
      filename: "apps/api/src/domain/access/value-objects/example.typecheck.ts",
      code: "export type Test = string;",
    },
  ],
  invalid: [
    {
      filename,
      code: 'const other = z.string().brand<"Other">(); const schema = z.string(); export type Example = z.output<typeof schema>;',
      errors: [{ messageId: "missingBrand" }],
    },
    { filename, code: "export class Example {}", errors: [{ messageId: "classValue" }] },
    { filename, code: "export const Example = class {};", errors: [{ messageId: "classValue" }] },
    {
      filename,
      code: 'export type Example = "one" | "two";',
      errors: [{ messageId: "brandedType" }, { messageId: "missingBrand" }],
    },
    {
      filename,
      code: "const schema = z.string(); export type Example = z.output<typeof schema>;",
      errors: [{ messageId: "missingBrand" }],
    },
    ...[
      "z.object({ value: z.string() })",
      "z.array(z.string())",
      "z.string().array()",
      "z.tuple([z.string(), z.number()])",
      "z.record(z.string(), z.string())",
    ].map((schema) => ({
      filename,
      code: `const schema = ${schema}.brand<"Example">(); export type Example = z.output<typeof schema>;`,
      errors: [{ messageId: "compositeSchema" }],
    })),
  ],
});
