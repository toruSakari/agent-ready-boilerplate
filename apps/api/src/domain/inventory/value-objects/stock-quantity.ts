import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

// 在庫切れの0を表せる数量。予約数とは分け、加減算の結果もcreateで再検証する。
export const STOCK_QUANTITY_LIMITS = Object.freeze({ min: 0, max: Number.MAX_SAFE_INTEGER });
const schema = z
  .number()
  .int()
  .min(STOCK_QUANTITY_LIMITS.min)
  .max(STOCK_QUANTITY_LIMITS.max)
  .brand<"StockQuantity">();

export type StockQuantity = z.output<typeof schema>;

export const StockQuantity = Object.freeze({
  create(value: unknown): StockQuantity {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      "在庫数は0以上の安全な整数にしてください",
    );
  },
});
