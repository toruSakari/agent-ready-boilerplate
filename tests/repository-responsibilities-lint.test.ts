import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`Repositoryの責務境界: ${name}`, run);
RuleTester.it = (name, run) => it(`依存を検査する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`依存を検査する: ${name}`, run);
const tester = new RuleTester({ cwd: "/repository" });
const filename = "apps/api/src/infrastructure/access/repositories/d1-access-repository.ts";
const query = "#api/infrastructure/access/queries/d1-access-query.ts";
tester.run("project/repository-responsibilities", plugin.rules["repository-responsibilities"], {
  valid: [
    {
      filename: "apps/api/src/application/access/stores/access-audit-store.ts",
      code: 'import type { AuditEntry } from "#api/domain/access/repositories/access-repository.ts";',
    },
    {
      filename: "apps/api/src/infrastructure/payment/repositories/d1-payment-repository.ts",
      code: 'import type { Payment } from "#api/domain/payment/entities/payment.ts";',
    },
    {
      filename: "apps/api/src/application/order/use-cases/example-use-case.ts",
      code: `import * as dtos from "#api/application/order/dtos/example-dto.ts"; class ExampleUseCase { async execute(input: dtos.ExampleInputDto): Promise<dtos.ExampleOutputDto> { return dtos.ExampleOutputDto.parse({ok: true}); } }`,
    },
    {
      filename: "apps/api/src/application/order/use-cases/example-use-case.ts",
      code: `import type { ExampleInputDto, ExampleOutputDto } from "#api/application/order/dtos/example-dto.ts"; class ExampleUseCase { async execute(input: ExampleInputDto): Promise<ExampleOutputDto> { return { ok: true }; } private find(id: string) { return id; } }`,
    },
    {
      filename: "apps/api/src/application/order/use-cases/list-orders-use-case.ts",
      code: 'import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";',
    },
    {
      filename: "apps/api/src/application/order/use-cases/list-orders-use-case.test.ts",
      code: `import { Query } from "${query}";`,
    },
    { filename, code: 'import { Entity } from "#api/domain/access/entities/organization.ts";' },
    {
      filename,
      code: 'import { value } from "#api/infrastructure/access/shared/access-record-selections.ts";',
    },
    { filename, code: 'import { schema } from "#api/infrastructure/order/schemas/schema.ts";' },
    {
      filename: filename.replace(".ts", ".integration.test.ts"),
      code: `import { Query } from "${query}";`,
    },
    {
      filename: "apps/api/src/infrastructure/access/queries/d1-access-query.ts",
      code: "export class Query {}",
    },
    {
      filename,
      code: 'import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";',
    },
  ],
  invalid: [
    ...["application", "infrastructure"].map((layer) => ({
      filename: `apps/api/src/${layer}/payment/stores/payment-store.ts`,
      code: 'import type { Payment } from "#api/domain/payment/entities/payment.ts";',
      errors: [{ messageId: "storeEntity" }],
    })),
    ...[
      "async execute(actor: Actor, id: string): Promise<OutputDto> { return { ok: true }; }",
      "async execute(input: InputDto): Promise<void> {}",
      "async execute(input: InputDto): Promise<Entity> { return entity; }",
      "async execute(input: InputDto) { return { ok: true }; }",
    ].map((method) => ({
      filename: "apps/api/src/application/order/use-cases/example-use-case.ts",
      code: `import type { InputDto, OutputDto } from "#api/application/order/dtos/example-dto.ts"; class ExampleUseCase { ${method} }`,
      errors: [{ messageId: "useCaseDto" }],
    })),
    {
      filename: "apps/api/src/application/order/use-cases/list-orders-use-case.ts",
      code: 'import type { Query } from "#api/application/order/queries/order-query.ts";',
      errors: [{ messageId: "useCaseQuery" }],
    },
    {
      filename: "apps/api/src/application/order/use-cases/list-orders-use-case.ts",
      code: `type Query = import("${query}").Query;`,
      errors: [{ messageId: "useCaseQuery" }],
    },
    ...[
      `import { Query } from "${query}";`,
      `export * from "${query}";`,
      `const module = import(\`${query}\`);`,
      `type Query = import("${query}").Query;`,
      'import { Query } from "#api/application/access/queries/access-query.ts";',
      'import { Store } from "#api/infrastructure/order/messaging/d1-outbox-store.ts";',
      'import { Store } from "#api/application/product/storage/product-image-store.ts";',
      `const module = require("${query}");`,
    ].map((code) => ({ filename, code, errors: [{ messageId: "adapterDependency" }] })),
    {
      filename: "apps/api/src/infrastructure/order/repositories/order-write-queries.ts",
      code: "export function updateOrderRecord() {}",
      errors: [{ messageId: "queryFile" }],
    },
  ],
});
