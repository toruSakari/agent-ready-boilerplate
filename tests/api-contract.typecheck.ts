import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "#api/presentation/app-router.ts";
import type { RouterInputs, RouterOutputs } from "@dev-template/api-types";

// サーバーと配布用の生成型を別々に導出し、片側だけの契約変更を型検査で検出する。
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Assert<T extends true> = T;

export type InputContractMatchesServer = Assert<Equal<RouterInputs, inferRouterInputs<AppRouter>>>;

export type OutputContractMatchesServer = Assert<
  Equal<RouterOutputs, inferRouterOutputs<AppRouter>>
>;

type ServiceCategory = "customer" | "business" | "operator";

type SelectedService<T> = T extends { service: infer Service } ? Service : never;

type LifecycleProcedure = "registration" | "session" | "withdraw" | "acceptInvitation";

type ScopedAccessProcedure =
  | "members"
  | "roles"
  | "saveRole"
  | "invite"
  | "assignRole"
  | "removeMember"
  | "audit";

export type LifecycleRequiresExplicitService = Assert<
  Equal<
    { [Procedure in LifecycleProcedure]: SelectedService<RouterInputs["access"][Procedure]> },
    { [Procedure in LifecycleProcedure]: ServiceCategory }
  >
>;

export type ScopedAccessRequiresManagementService = Assert<
  Equal<
    { [Procedure in ScopedAccessProcedure]: SelectedService<RouterInputs["access"][Procedure]> },
    { [Procedure in ScopedAccessProcedure]: "business" | "operator" }
  >
>;

export type OrdersRequireCustomerOrBusinessService = Assert<
  Equal<
    {
      [Procedure in keyof RouterInputs["order"]]: SelectedService<RouterInputs["order"][Procedure]>;
    },
    { [Procedure in keyof RouterInputs["order"]]: "customer" | "business" }
  >
>;

export type ProductListRequiresCustomerOrBusinessService = Assert<
  Equal<SelectedService<RouterInputs["product"]["list"]>, "customer" | "business">
>;

export type HealthRequiresExplicitService = Assert<
  Equal<SelectedService<RouterInputs["health"]>, ServiceCategory>
>;
