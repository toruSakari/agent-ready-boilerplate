import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

// 商品と注文明細が共有する整数単価の制約。無料の商品を表せるよう0を許容する。
export const UNIT_PRICE_LIMITS = Object.freeze({ min: 0, max: 10_000_000 });

const schema = z
  .number()
  .int()
  .min(UNIT_PRICE_LIMITS.min)
  .max(UNIT_PRICE_LIMITS.max)
  .brand<"UnitPrice">();

export type UnitPrice = z.output<typeof schema>;

export const UnitPrice = Object.freeze({
  create(value: unknown): UnitPrice {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      `単価は${UNIT_PRICE_LIMITS.min}以上${UNIT_PRICE_LIMITS.max}以下の整数にしてください`,
    );
  },
});
