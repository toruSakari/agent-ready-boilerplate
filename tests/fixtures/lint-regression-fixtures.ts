export const lintRegressions = {
  "apps/api/src/domain/interface/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

export interface OrderLine { sku: string }

export const OrderLine = { create() { return { sku: "sku" }; } };
`,
  "apps/api/src/domain/local/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

type OrderLine = { sku: string };

export type { OrderLine };
`,
  "apps/api/src/domain/union/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

export type OrderLine = OrderLineEntity | { sku: string };
`,
  "apps/api/src/application/demo/providers/account-service.ts":
    "export const AccountService = class {};\n",
  "apps/api/src/application/demo/shared/create-order-use-case.ts":
    "export const CreateOrderUseCase = class {};\n",
  "apps/api/src/application/demo/use-cases/present-orders-use-case.ts":
    "export function presentOrders() {}\n",
};

export const lintRegressionControls = {
  "apps/api/src/domain/direct/entities/order-line.ts": "export class OrderLine {}\n",
  "apps/api/src/domain/mapped/entities/order-line.ts": `type Status = "draft" | "placed";

export class OrderLineEntity<S extends Status> { constructor(readonly status: S) {} }

export type OrderLine = { [S in Status]: OrderLineEntity<S> }[Status];
`,
  "apps/api/src/domain/alias/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

type Line = OrderLineEntity;

type OrderLine = Line;

export type { OrderLine };
`,
  "apps/api/src/domain/valid-union/entities/order-line.ts": `export class OrderLineEntity<S> { constructor(readonly state: S) {} }

export type OrderLine = OrderLineEntity<"draft"> | OrderLineEntity<"placed">;
`,
  "apps/api/src/application/demo/providers/account-provider.ts":
    "export const AccountProvider = class {};\n",
  "apps/api/src/application/demo/use-cases/create-order-use-case.ts":
    "export const CreateOrderUseCase = class {};\n",
  "apps/api/src/application/demo/policies/invitation-policy.ts":
    "export const InvitationPolicy = class {};\n",
  "apps/api/src/application/demo/use-cases/fixture.test-fixture.ts":
    "export function fixture() {}\n",
  "apps/api/src/application/demo/use-cases/contracts.typecheck.ts":
    "export type Contract = string;\n",
  "apps/api/src/domain/demo/entities/order-line.test.ts": "export const fixture = {};\n",
  "apps/api/src/application/demo/use-cases/fixture.test.ts": "export function fixture() {}\n",
};

export const lintReviewRegressions = {
  "apps/api/src/domain/empty-intersection/entities/order-line.ts": `export class OrderLineEntity {}

type Empty = string & number;

export type OrderLine = Empty extends string ? never : OrderLineEntity;
`,
  "apps/api/src/domain/initializer-assertion/entities/order-line.ts": `const OrderLine = class OrderLine {} as object;

export default OrderLine;
`,
  "apps/api/src/domain/unknown-primitive/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = unknown extends string ? OrderLineEntity : never;
`,
  "apps/api/src/domain/signed-literal/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = -1 extends 1 ? OrderLineEntity : never;
`,
  "apps/api/src/domain/boolean-union/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = boolean extends true | false ? never : OrderLineEntity;
`,
  "apps/api/src/domain/template-mismatch/entities/order-line.ts":
    "export class OrderLineEntity {}\n\nexport type OrderLine = `${string}` extends number ? OrderLineEntity : never;\n",
  "apps/api/src/domain/primitive-array/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = string extends string[] ? OrderLineEntity : never;
`,
  "apps/api/src/domain/abstract-constructor/entities/order-line.ts": `class OrderLine {}

export default (OrderLine as abstract new () => OrderLine);
`,
  "apps/api/src/domain/nullish-object/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = null extends {} ? OrderLineEntity : never;
`,
  "apps/api/src/domain/primitive-void/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = string extends void ? OrderLineEntity : never;
`,
  "apps/api/src/domain/tuple-arity/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = [OrderLineEntity, string] extends [infer T] ? T : never;
`,
  "apps/api/src/domain/imported-reexport/entities/order-line.ts": `import type { ZodRawShape } from "zod";

export class OrderLineEntity {}

export type { ZodRawShape as OrderLine };
`,
  "apps/api/src/domain/primitive-object/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = string extends object ? OrderLineEntity : never;
`,
  "apps/api/src/domain/erased-default/entities/order-line.ts": `class OrderLine {}

export default (OrderLine as object)!;
`,
  "apps/api/src/domain/never-target/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = string extends never ? OrderLineEntity : never;
`,
  "apps/api/src/domain/star/entities/order-line.ts": `export class OrderLineEntity {}

export * from "zod";
`,
  "apps/api/src/domain/unreachable/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = string extends number ? OrderLineEntity : never;
`,
  "apps/api/src/domain/reexport/entities/order-line.ts": `export class OrderLineEntity {}

export type { ZodRawShape as OrderLine } from "zod";
`,
  "apps/api/src/domain/inference/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

export type OrderLine = {value: {sku: string}} extends {value: infer T extends OrderLineEntity} ? T : OrderLineEntity;
`,
  "apps/api/src/application/ambient/use-cases/create-order-use-case.ts":
    "declare class CreateOrderUseCase {}\n\nexport { CreateOrderUseCase };\n",
  "apps/api/src/domain/shadow/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

export type OrderLine<OrderLineEntity> = OrderLineEntity;
`,
  "apps/api/src/domain/intermediate/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

type Helper<OrderLineEntity> = OrderLineEntity;

export type OrderLine = Helper<{sku: string}>;
`,
  "apps/api/src/application/demo/use-cases/create-order-use-case.ts":
    "export declare class CreateOrderUseCase {}\n",
};

export const lintReviewControls = {
  "apps/api/src/domain/constructor-overload-intersection/entities/order-line.ts": `class OrderLine {}

export default (OrderLine as typeof OrderLine & (new (value: string) => OrderLine));
`,
  "apps/api/src/domain/non-nullable-constructor/entities/order-line.ts": `class OrderLine {}

export default (OrderLine as NonNullable<typeof OrderLine | null>);
`,
  "apps/api/src/domain/merged-constructor/entities/order-line.ts": `class OrderLine {}

interface Constructor {new(): OrderLine}

interface Constructor {tag: string}

export default (OrderLine as Constructor);
`,
  "apps/api/src/domain/unknown-top-union/entities/order-line.ts": `export class OrderLineEntity {}

export type OrderLine = unknown extends {} | null | undefined ? OrderLineEntity : {sku: string};
`,
  "apps/api/src/domain/static-members/entities/order-line.ts": `class OrderLine {}

export default (OrderLine as typeof OrderLine & {tag: string});
`,
  "apps/api/src/domain/boolean-filter/entities/order-line.ts": `export class OrderLineEntity {}

type Filter<T> = T extends true ? OrderLineEntity : never;

export type OrderLine = Filter<boolean>;
`,
  "apps/api/src/domain/template-identity/entities/order-line.ts":
    "export class OrderLineEntity {}\n\ntype State = `state-${string}`;\n\nexport type OrderLine = State extends State ? OrderLineEntity : {sku: string};\n",
  "apps/api/src/domain/inherited-constructor/entities/order-line.ts": `class OrderLine {}

interface Base { new (): OrderLine }

interface Constructor extends Base {}

export default (OrderLine as Constructor);
`,
  "apps/api/src/domain/template-string/entities/order-line.ts":
    "export class OrderLineEntity {}\n\ntype State = `${string}`;\n\nexport type OrderLine = State extends string ? OrderLineEntity : {sku: string};\n",

  "apps/api/src/domain/constructor-intersection/entities/order-line.ts": `class OrderLine {}

export default (OrderLine as typeof OrderLine & object);
`,
  "apps/api/src/domain/generic-identity/entities/order-line.ts": `export class OrderLineEntity<S> { constructor(readonly state: S) {} }

export type OrderLine = OrderLineEntity<"draft"> extends OrderLineEntity<"draft"> ? OrderLineEntity<"draft"> : {sku: string};
`,
  "apps/api/src/domain/satisfies-default/entities/order-line.ts": `class OrderLine {}

export default (OrderLine satisfies object)!;
`,
  "apps/api/src/domain/constructor-default/entities/order-line.ts": `class OrderLine {}

type Constructor = typeof OrderLine;

export default (OrderLine as Constructor);
`,
  "apps/api/src/domain/parenthesized/entities/order-line.ts": `export class OrderLineEntity {}

type Filter<T> = (T) extends "draft" ? OrderLineEntity : never;

export type OrderLine = Filter<"draft" | "placed">;
`,
  "apps/api/src/domain/generic-object/entities/order-line.ts": `export class OrderLineEntity<S> { constructor(readonly state: S) {} }

export type OrderLine = OrderLineEntity<"draft"> extends object ? OrderLineEntity<"draft"> : {sku: string};
`,
  "apps/api/src/domain/interface-object/entities/order-line.ts": `interface Base { tag: string }

interface Source extends Base {}

export class OrderLineEntity {}

export type OrderLine = Source extends object ? OrderLineEntity : {sku: string};
`,
  "apps/api/src/domain/nested-inference/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

export type OrderLine = {value: OrderLineEntity} extends {value: infer T extends OrderLineEntity} ? T : never;
`,
  "apps/api/src/application/wrapped/use-cases/create-order-use-case.ts":
    "export default (class CreateOrderUseCase {}) satisfies object;\n",
  "apps/api/src/domain/filtered/entities/order-line.ts": `export class OrderLineEntity<S> { constructor(readonly state: S) {} }

export type OrderLine<S> = S extends "draft" ? OrderLineEntity<"draft"> : never;
`,
  "apps/api/src/domain/additive/entities/order-line.ts": `export class OrderLineEntity { constructor(readonly sku: string) {} }

type Tagged = { tag: string };

export type OrderLine = OrderLineEntity & Tagged;
`,
  "apps/api/src/application/demo/dtos/example-input-dto.ts": `import { z } from "zod";

type Defaults = { limit: number };

export const Defaults: Defaults = { limit: 5 };

export const ExampleInputDto = z.object({ limit: z.number() }).brand<"ExampleInputDto">();
export type ExampleInputDto = z.infer<typeof ExampleInputDto>;
`,
  "apps/api/src/domain/demo/value-objects/example.ts": `import { z } from "zod";

type Defaults = { limit: number };

export const Defaults: Defaults = { limit: 5 };

export const exampleSchema = z.string().brand<"Example">();

export type Example = z.infer<typeof exampleSchema>;

export const Example = { create(value: string) { return exampleSchema.parse(value); } };
`,
};

export const lintEmptyConditionalControl = {
  "apps/api/src/domain/empty-conditional/entities/order-line.ts": `export class OrderLineEntity {}

type Empty = string extends string ? never : never;

export type OrderLine = OrderLineEntity | Empty;
`,
};
