import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

export const PRODUCT_NAME_LIMITS = Object.freeze({ minLength: 1, maxLength: 120 });

// 商品名は保存済みの値を勝手に正規化しない。入力時の前後空白除去はAPIや商品作成の入口が担う。
const schema = z
  .string()
  .min(PRODUCT_NAME_LIMITS.minLength)
  .max(PRODUCT_NAME_LIMITS.maxLength)
  .refine((value) => value.trim().length > 0)
  .brand<"ProductName">();

export type ProductName = z.output<typeof schema>;

export const ProductName = Object.freeze({
  create(value: unknown): ProductName {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      `商品名は${PRODUCT_NAME_LIMITS.minLength}文字以上${PRODUCT_NAME_LIMITS.maxLength}文字以下で指定してください`,
    );
  },
});
