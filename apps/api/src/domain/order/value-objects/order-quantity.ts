import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

// 一つの注文明細の数量上限。API入力も同じ制約を参照し、在庫全体の容量とは区別する。
export const ORDER_QUANTITY_LIMITS = Object.freeze({ min: 1, max: 100 });

const schema = z
  .number()
  .int()
  .min(ORDER_QUANTITY_LIMITS.min)
  .max(ORDER_QUANTITY_LIMITS.max)
  .brand<"OrderQuantity">();

export type OrderQuantity = z.output<typeof schema>;

export const OrderQuantity = Object.freeze({
  create(value: unknown): OrderQuantity {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      `数量は${ORDER_QUANTITY_LIMITS.min}以上${ORDER_QUANTITY_LIMITS.max}以下の整数にしてください`,
    );
  },
});
