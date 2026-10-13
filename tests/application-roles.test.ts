import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`applicationの配置: ${name}`, run);
RuleTester.it = (name, run) => it(`役割と配置を検証する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`役割と配置を検証する: ${name}`, run);
const tester = new RuleTester({ cwd: "/repository" });
const root = "apps/api/src/application/";

tester.run("project/application-roles", plugin.rules["application-roles"], {
  valid: (
    [
      [
        "order/use-cases/create-order-use-case.ts",
        "export default (class CreateOrderUseCase {}) satisfies object;",
      ],
      [
        "order/use-cases/create-order-use-case.ts",
        "export default ((class CreateOrderUseCase {}) as object)!;",
      ],
      [
        "order/use-cases/create-order-use-case.ts",
        "class CreateOrderUseCase {} export default (CreateOrderUseCase satisfies object);",
      ],
      ["order/use-cases/create-order-use-case.ts", "export const CreateOrderUseCase = class {};"],
      [
        "order/use-cases/create-order-use-case.ts",
        "class CreateOrderUseCase {} export {CreateOrderUseCase};",
      ],
      ["order/use-cases/create-order-use-case.ts", "export default class CreateOrderUseCase {}"],
      [
        "order/use-cases/create-order-use-case.ts",
        "export const CreateOrderUseCase = class Implementation {};",
      ],
      [
        "order/use-cases/create-order-use-case.ts",
        "export const CreateOrderUseCase = (class {}) satisfies object;",
      ],
      ["auth/providers/account-provider.ts", "export const AccountProvider = class {};"],
      ["access/policies/invitation-policy.ts", "export const InvitationPolicy = class {};"],
      ["order/use-cases/create-order-use-case.ts", "export class CreateOrderUseCase {}"],
      [
        "order/use-cases/create-order-use-case.ts",
        "class CreateOrderUseCase {} export default CreateOrderUseCase;",
      ],
      ["access/use-cases/access-use-cases.ts", "export class AccessUseCases {}"],
      ["auth/providers/account-identity-provider.ts", "export class AccountIdentityProvider {}"],
      ["access/policies/invitation-issuer-policy.ts", "export class InvitationIssuerPolicy {}"],
      ["auth/contracts/identity.ts", "export type Identity = string;"],
      ["auth/schemas/actor.ts", "export const schema = {};"],
      ["order/mappers/present-orders.ts", "export function presentOrders() {}"],
      ["access/shared/invitation-token.ts", "export function hashInvitation() {}"],
      ["shared/application-error.ts", "export class ApplicationError extends Error {}"],
      ["container.ts", "export type ApplicationContainer = {};"],
      ["auth/legacy.test.ts", "class LegacyService {}"],
      ["order/use-cases/clients.test-fixture.ts", "export function client() {}"],
      ["order/use-cases/contract.typecheck.ts", "export type Contract = string;"],
    ] as const
  ).map((props) => ({ filename: root + props[0], code: props[1] })),
  invalid: (
    [
      [
        "order/use-cases/create-order-use-case.ts",
        "export declare class CreateOrderUseCase {}",
        "filePlacement",
      ],
      [
        "order/use-cases/create-order-use-case.ts",
        "declare class CreateOrderUseCase {} export {CreateOrderUseCase};",
        "filePlacement",
      ],
      [
        "order/use-cases/create-order-use-case.ts",
        "export default interface CreateOrderUseCase {}",
        "filePlacement",
      ],
      [
        "auth/providers/account-service.ts",
        "export const AccountService = class {};",
        "serviceName",
      ],
      [
        "auth/providers/account-service.ts",
        "export const AccountService = (class {}) as object;",
        "serviceName",
      ],
      [
        "auth/providers/account-service.ts",
        "export const AccountService = (class {}) satisfies object;",
        "serviceName",
      ],
      [
        "order/shared/create-order-use-case.ts",
        "export const CreateOrderUseCase = class {};",
        "classPlacement",
      ],
      [
        "auth/shared/account-provider.ts",
        "export const AccountProvider = class {};",
        "classPlacement",
      ],
      [
        "access/shared/invitation-policy.ts",
        "export const InvitationPolicy = class {};",
        "classPlacement",
      ],
      [
        "order/use-cases/present-orders-use-case.ts",
        "export function presentOrders() {}",
        "filePlacement",
      ],
      [
        "order/use-cases/present-orders-use-case.ts",
        "export const presentOrders = () => {};",
        "filePlacement",
      ],
      ["order/use-cases/create-order-use-case.ts", "class CreateOrderUseCase {}", "filePlacement"],
      ["order/use-cases/create-order-use-case.ts", "export class OtherUseCase {}", "filePlacement"],
      [
        "order/use-cases/create-order-use-case.ts",
        "export const CreateOrderUseCase = {};",
        "filePlacement",
      ],
      [
        "order/use-cases/create-order-use-case.ts",
        "class CreateOrderUseCase {} export type {CreateOrderUseCase};",
        "filePlacement",
      ],
      [
        "auth/providers/account-identity-service.ts",
        "export class AccountIdentityService {}",
        "serviceName",
      ],
      ["order/shared/order.ts", "export class CreateOrderUseCase {}", "classPlacement"],
      ["auth/policies/identity.ts", "export class IdentityProvider {}", "classPlacement"],
      ["access/shared/invitation.ts", "export class InvitationPolicy {}", "classPlacement"],
      ["order/present-orders.ts", "export function presentOrders() {}", "filePlacement"],
      [
        "access/use-cases/invitation-token.ts",
        "export function hashInvitation() {}",
        "filePlacement",
      ],
      ["access/shared/legacy.ts", "export const legacy = class AccountService {};", "serviceName"],
    ] as const
  ).map((props) => ({
    filename: root + props[0],
    code: props[1],
    errors: [{ messageId: props[2] }],
  })),
});
