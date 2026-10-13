import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

export const SKU_LIMITS = Object.freeze({ minLength: 1, maxLength: 64 });

// SKUは保存済みの値を勝手に正規化しない。入力時の前後空白除去はAPIや商品作成の入口が担う。
const schema = z
  .string()
  .min(SKU_LIMITS.minLength)
  .max(SKU_LIMITS.maxLength)
  .refine((value) => value.trim().length > 0)
  .brand<"Sku">();

export type Sku = z.output<typeof schema>;

export const Sku = Object.freeze({
  create(value: unknown): Sku {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      `SKUは${SKU_LIMITS.minLength}文字以上${SKU_LIMITS.maxLength}文字以下で指定してください`,
    );
  },
});
