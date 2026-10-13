// コンパイル時だけの契約検査。本番コードからはインポートしない。
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import type { ProductUseCases } from "#api/application/product/use-cases/product-use-cases.ts";

type Assert<T extends true> = T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

export type AuthorizedActorContracts = [
  Assert<Equal<Assignable<Identity, AuthorizedActor>, false>>,
  Assert<Equal<Assignable<AuthorizedActor, Identity>, true>>,
  Assert<Equal<Awaited<ReturnType<typeof prepareAuthorizedActor>>, AuthorizedActor>>,
  Assert<Equal<Parameters<ProductUseCases["list"]>[0]["identity"], AuthorizedActor>>,
  Assert<Equal<Parameters<CreateOrderUseCase["execute"]>[0]["identity"], AuthorizedActor>>,
];
