import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`VO・DTOのファイル分割: ${name}`, run);
RuleTester.it = (name, run) => it(`一組の定義を検証する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`一組の定義を検証する: ${name}`, run);
const tester = new RuleTester({ cwd: "/repository" });

for (const [rule, filename] of [
  ["one-value-object-per-file", "apps/api/src/domain/demo/value-objects/example.ts"],
  ["one-dto-per-file", "apps/api/src/application/demo/dtos/example.ts"],
] as const) {
  tester.run(`project/${rule}`, plugin.rules[rule], {
    valid: [
      ...[
        'type Defaults = {limit: number}; export const Defaults: Defaults = {limit: 5}; const schema = z.string().brand<"Example">(); export type Example = z.infer<typeof schema>;',
        'interface Defaults {limit: number} export const Defaults: Defaults = {limit: 5}; const schema = z.string().brand<"Example">(); export type Example = z.infer<typeof schema>;',
        'type Defaults = {limit: number}; const Defaults: Defaults = {limit: 5}; export default Defaults; const schema = z.string().brand<"Example">(); export type Example = z.infer<typeof schema>;',
        'type Example = string; export const Example = z.string().brand<"Example">();',
      ].map((code) => ({ filename, code })),
      {
        filename,
        code: 'const schema = z.string().brand<"Example">(); export type Example = z.output<typeof schema>; export const Example = {create(value: unknown) {return schema.parse(value);}};',
      },
      {
        filename,
        code: 'const schema = z.string().brand<"Example">(); type Example = z.infer<typeof schema>; export type {Example};',
      },
      {
        filename,
        code: 'export const Example = <T>(item: T) => make(item).brand<"Example">(); export type Example<T> = z.output<ReturnType<typeof Example<T>>>;',
      },
      { filename, code: 'export {First, Second} from "external";' },
      { filename, code: 'import {First, Second} from "external"; export {First, Second};' },
      { filename, code: "export const sharedSchema = z.string();" },
      {
        filename: filename.replace(".ts", ".test.ts"),
        code: "export type First = string; export type Second = number;",
      },
      {
        filename: filename.replace(".ts", ".typecheck.ts"),
        code: "export type First = string; export type Second = number;",
      },
      {
        filename: "apps/api/src/domain/demo/policies/definitions.ts",
        code: "export type First = string; export type Second = number;",
      },
    ],
    invalid: [
      'type Defaults = {limit: number}; export const Defaults: Defaults = {limit: 5}; export type {Defaults}; const schema = z.string().brand<"Example">(); export type Example = z.infer<typeof schema>;',
      'type Defaults = {limit: number}; const Defaults: Defaults = {limit: 5}; export {Defaults}; const schema = z.string().brand<"Example">(); export type Example = z.infer<typeof schema>;',
      'export type Defaults = {limit: number}; export const Defaults: Defaults = {limit: 5}; const schema = z.string().brand<"Example">(); export type Example = z.infer<typeof schema>;',

      'const first = z.string().brand<"First">(); export type First = z.output<typeof first>; const second = z.string().brand<"Second">(); export type Second = z.output<typeof second>;',
      'const first = z.string().brand<"First">(); const second = z.string().brand<"Second">();',
      'import {first,second} from "external"; type First = z.infer<typeof first>; type Second = z.output<typeof second>; export type {First, Second};',
      'export const FirstInputDto = z.string().brand<"FirstInputDto">(); export const FirstOutputDto = z.string().brand<"FirstOutputDto">();',
    ].map((code) => ({ filename, code, errors: [{ messageId: "multipleDefinitions" }] })),
  });
}
