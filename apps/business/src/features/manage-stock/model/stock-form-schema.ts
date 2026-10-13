import { z } from "zod";
import { t } from "@dev-template/client/i18n";
import { stockInputSchema, stockReasons } from "#business/entities/inventory/index.ts";
import type { StockOperation } from "#business/entities/inventory/index.ts";

export function stockFormSchema(operation: StockOperation) {
  return z.object({
    quantity:
      operation === "receive"
        ? stockInputSchema.min(1, { error: () => t("入荷数は1以上の整数を入力してください") })
        : stockInputSchema,
    reason: z
      .enum(["delivery", "return", "stocktake", "damage", "correction"])
      .refine((value) => stockReasons[operation].includes(value), {
        error: () => t("操作に合った理由を選択してください"),
      }),
  });
}
