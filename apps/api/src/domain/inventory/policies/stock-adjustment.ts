import { z } from "zod";
import {
  StockQuantity,
  STOCK_QUANTITY_LIMITS,
} from "#api/domain/inventory/value-objects/stock-quantity.ts";

export const STOCK_ADJUSTMENT_REASONS = Object.freeze({
  receive: ["delivery", "return"],
  recount: ["stocktake", "damage", "correction"],
} as const);
const quantity = z.number().int().min(STOCK_QUANTITY_LIMITS.min).max(STOCK_QUANTITY_LIMITS.max);
export const stockAdjustmentSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("receive"),
      quantity: quantity.positive(),
      reason: z.enum(STOCK_ADJUSTMENT_REASONS.receive),
    })
    .strict(),
  z
    .object({
      operation: z.literal("recount"),
      quantity,
      reason: z.enum(STOCK_ADJUSTMENT_REASONS.recount),
      expectedStock: quantity,
    })
    .strict(),
]);

export type StockAdjustment = z.infer<typeof stockAdjustmentSchema>;

/** 入荷は加算、棚卸しは実数への置換。演算後も数量の業務上限を検証する。 */
export function adjustedStock(onHand: StockQuantity, input: StockAdjustment): StockQuantity {
  return StockQuantity.create(
    input.operation === "receive" ? onHand + input.quantity : input.quantity,
  );
}
