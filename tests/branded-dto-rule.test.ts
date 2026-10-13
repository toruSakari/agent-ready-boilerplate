import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`DTOのブランド: ${name}`, run);
RuleTester.it = (name, run) => it(`検証済みDTOの規約: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`検証済みDTOの規約: ${name}`, run);
const tester = new RuleTester({ cwd: "/repository" });
const filename = "apps/api/src/application/product/dtos/example-dto.ts";
tester.run("project/branded-dto", plugin.rules["branded-dto"], {
  valid: [
    {
      filename,
      code: 'const shape = z.object({id:z.string()}); export const ExampleDto = shape.brand<"ExampleDto">().readonly(); export type ExampleDto = z.infer<typeof ExampleDto>;',
    },
    {
      filename,
      code: 'export { ProductGetInputDto as ExampleDto } from "#api/application/product/dtos/product-get-input-dto.ts";',
    },
    {
      filename,
      code: 'export const PageDto = <S extends z.ZodType>(item:S) => z.object({items:z.array(item)}).brand<"PageDto">(); export type PageDto<T> = z.output<ReturnType<typeof PageDto<z.ZodType<T>>>>;',
    },
  ],
  invalid: [
    {
      filename: "apps/api/src/presentation/product/trpc-router.ts",
      code: "const input = value as dtos.ProductGetInputDto;",
      errors: [{ messageId: "brandCast" }],
    },
    ...[
      "export type ExampleDto = { id: string };",
      "export interface ExampleDto { id: string }",
      "export class ExampleDto {}",
      "export const ExampleDto = class {};",
      "export const ExampleDto = z.object({id:z.string()}); export type ExampleDto = z.infer<typeof ExampleDto>;",
      'export const ExampleDto = z.object({id:z.string()}).brand<"OtherDto">(); export type ExampleDto = z.output<typeof ExampleDto>;',
    ].map((code) => ({ filename, code, errors: [{ messageId: "brandedDto" }] })),
    {
      filename: "apps/api/src/presentation/product/trpc-router.ts",
      code: "const input = value as ProductGetInputDto;",
      errors: [{ messageId: "brandCast" }],
    },
  ],
});
