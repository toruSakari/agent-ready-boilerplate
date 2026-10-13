import { t as translate } from "#client/shared/i18n";
import { CATALOG_INPUT_LIMITS, ORDER_INPUT_LIMITS } from "#client/shared/config/input-limits";
import { z } from "zod";

// 作成・下書き編集で同じ入力補助を使う。APIとドメインの検証は別の信頼境界として残す。
const lineSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(CATALOG_INPUT_LIMITS.textMinLength, { error: () => translate("SKUを入力してください") })
    .max(CATALOG_INPUT_LIMITS.skuMaxLength, {
      error: () =>
        translate("SKUは{{max}}文字以下にしてください", { max: CATALOG_INPUT_LIMITS.skuMaxLength }),
    }),
  name: z
    .string()
    .trim()
    .min(CATALOG_INPUT_LIMITS.textMinLength, { error: () => translate("商品名を入力してください") })
    .max(CATALOG_INPUT_LIMITS.nameMaxLength, {
      error: () =>
        translate("商品名は{{max}}文字以下にしてください", {
          max: CATALOG_INPUT_LIMITS.nameMaxLength,
        }),
    }),
  // valueAsNumberの空欄はNaNのまま拒否し、空文字を数量0へ暗黙変換しない。
  quantity: z
    .number({
      error: () =>
        translate("数量は{{min}}以上{{max}}以下の整数にしてください", {
          min: ORDER_INPUT_LIMITS.quantityMin,
          max: ORDER_INPUT_LIMITS.quantityMax,
        }),
    })
    .int({ error: () => translate("数量は整数にしてください") })
    .min(ORDER_INPUT_LIMITS.quantityMin, {
      error: () =>
        translate("数量は{{min}}以上にしてください", { min: ORDER_INPUT_LIMITS.quantityMin }),
    })
    .max(ORDER_INPUT_LIMITS.quantityMax, {
      error: () =>
        translate("数量は{{max}}以下にしてください", { max: ORDER_INPUT_LIMITS.quantityMax }),
    }),
  unitPrice: z
    .number({
      error: () =>
        translate("単価は{{min}}以上{{max}}以下の整数にしてください", {
          min: CATALOG_INPUT_LIMITS.unitPriceMin,
          max: CATALOG_INPUT_LIMITS.unitPriceMax,
        }),
    })
    .int({ error: () => translate("単価は整数にしてください") })
    .min(CATALOG_INPUT_LIMITS.unitPriceMin, {
      error: () =>
        translate("単価は{{min}}以上にしてください", { min: CATALOG_INPUT_LIMITS.unitPriceMin }),
    })
    .max(CATALOG_INPUT_LIMITS.unitPriceMax, {
      error: () =>
        translate("単価は{{max}}以下にしてください", { max: CATALOG_INPUT_LIMITS.unitPriceMax }),
    }),
});
export const orderLinesSchema = z
  .array(lineSchema)
  .min(ORDER_INPUT_LIMITS.lineCountMin, {
    error: () =>
      translate("明細を{{min}}件以上入力してください", { min: ORDER_INPUT_LIMITS.lineCountMin }),
  })
  .max(ORDER_INPUT_LIMITS.lineCountMax, {
    error: () =>
      translate("明細は{{max}}件以下にしてください", { max: ORDER_INPUT_LIMITS.lineCountMax }),
  })
  .superRefine((lines, ctx) => {
    // trim済みSKUで重複を判定し、二件目以降の入力欄にエラーを関連付ける。
    const skus = new Set<string>();
    lines.forEach((line, index) => {
      if (skus.has(line.sku)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "sku"],
          message: translate("同じSKUの明細は一つにまとめてください"),
        });
      }

      skus.add(line.sku);
    });
  });
