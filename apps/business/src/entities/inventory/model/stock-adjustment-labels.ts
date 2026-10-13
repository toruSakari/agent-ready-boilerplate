import type { RouterInputs, RouterOutputs } from "@dev-template/api-types";
import { t } from "@dev-template/client/i18n";

export type StockOperation = RouterInputs["inventory"]["adjust"]["adjustment"]["operation"];

export type StockReason = RouterInputs["inventory"]["adjust"]["adjustment"]["reason"];

export const stockReasonLabels = {
  delivery: "仕入れ・入荷",
  return: "返品の受け入れ",
  stocktake: "棚卸し",
  damage: "破損・廃棄",
  correction: "数量の訂正",
} satisfies Record<StockReason, string>;
export const stockReasons: Record<StockOperation, readonly StockReason[]> = {
  receive: ["delivery", "return"],
  recount: ["stocktake", "damage", "correction"],
};
const operationLabels = { initial: "初期在庫", receive: "入荷", recount: "棚卸し・訂正" } as const;

export function stockHistoryLabels(entry: RouterOutputs["inventory"]["history"][number]) {
  return {
    operation: t(operationLabels[entry.operation]),
    reason: t(entry.reason === "initial" ? "商品登録" : stockReasonLabels[entry.reason]),
    actor: entry.actorName ?? t("在籍していない担当者"),
  };
}
