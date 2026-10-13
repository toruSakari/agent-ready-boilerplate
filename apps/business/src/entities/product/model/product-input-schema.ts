import { t as translate } from "@dev-template/client/i18n";
import { CATALOG_INPUT_LIMITS } from "@dev-template/client/config";
import { z } from "zod";

// 入力属性と同じ上限を使う入力補助。保存時の業務ルール・権限の検証はAPIに委ねる。
export const productInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(CATALOG_INPUT_LIMITS.textMinLength, {
      error: () => translate("SKUを入力してください"),
    })
    .max(CATALOG_INPUT_LIMITS.skuMaxLength, {
      error: () =>
        translate("SKUは{{max}}文字以下にしてください", {
          max: CATALOG_INPUT_LIMITS.skuMaxLength,
        }),
    }),
  name: z
    .string()
    .trim()
    .min(CATALOG_INPUT_LIMITS.textMinLength, {
      error: () => translate("商品名を入力してください"),
    })
    .max(CATALOG_INPUT_LIMITS.nameMaxLength, {
      error: () =>
        translate("商品名は{{max}}文字以下にしてください", {
          max: CATALOG_INPUT_LIMITS.nameMaxLength,
        }),
    }),
  unitPrice: z
    .number({
      error: () =>
        translate("価格は{{min}}以上{{max}}以下の整数にしてください", {
          min: CATALOG_INPUT_LIMITS.unitPriceMin,
          max: CATALOG_INPUT_LIMITS.unitPriceMax,
        }),
    })
    .int({ error: () => translate("価格は整数にしてください") })
    .min(CATALOG_INPUT_LIMITS.unitPriceMin, {
      error: () =>
        translate("価格は{{min}}以上にしてください", {
          min: CATALOG_INPUT_LIMITS.unitPriceMin,
        }),
    })
    .max(CATALOG_INPUT_LIMITS.unitPriceMax, {
      error: () =>
        translate("価格は{{max}}以下にしてください", {
          max: CATALOG_INPUT_LIMITS.unitPriceMax,
        }),
    }),
});
