// 画面に必要なDTO項目はプリミティブとして使え、サーバードメイン型を要求しないことを型検査する。
import type { RouterInputs, RouterOutputs } from "@dev-template/api-types";

type Assert<T extends true> = T;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type OrderLine = RouterOutputs["order"]["list"][number]["lines"][number];

type Product = RouterOutputs["product"]["list"][number];

export type ClientDtoContracts = [
  Assert<Equal<RouterInputs["access"]["registerCustomer"]["name"], string>>,
  Assert<Equal<RouterOutputs["access"]["registration"]["accountId"], string | null>>,
  Assert<
    Equal<RouterOutputs["access"]["registration"]["category"], "customer" | "business" | "operator">
  >,
  Assert<
    Equal<
      RouterOutputs["access"]["users"][number]["category"],
      "customer" | "business" | "operator"
    >
  >,
  Assert<Equal<RouterInputs["order"]["create"]["lines"][number]["quantity"], number>>,
  Assert<Equal<OrderLine["quantity"], number>>,
  Assert<Equal<OrderLine["unitPrice"], number>>,
  Assert<Equal<OrderLine["sku"], string>>,
  Assert<Equal<Product["sku"], string>>,
  Assert<Equal<Product["name"], string>>,
  Assert<Equal<Product["unitPrice"], number>>,
  Assert<Equal<RouterOutputs["product"]["create"]["unitPrice"], number>>,
];
