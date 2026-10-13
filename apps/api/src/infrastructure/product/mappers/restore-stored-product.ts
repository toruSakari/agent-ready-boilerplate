import { Product } from "#api/domain/product/entities/product.ts";
import { z } from "zod";
import {
  persistedText,
  persistedTimestamp,
} from "#api/infrastructure/shared/mappers/persisted-values.ts";

import { InvalidProductError } from "#api/domain/product/errors/invalid-product-error.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";

const schema = z.object({
  id: persistedText,
  tenantId: persistedText,
  sku: z.unknown().transform(Sku.create),
  name: z.unknown().transform(ProductName.create),
  unitPrice: z.unknown().transform(UnitPrice.create),
  imageKey: persistedText.nullable(),
  images: z.array(
    z.object({ id: persistedText, key: persistedText, createdAt: persistedTimestamp }),
  ),
  createdAt: persistedTimestamp,
});

// DBの結合結果を検証済みの値へ変換し、代表画像と画像一覧の整合性はドメインで確認する。
export function restoreStoredProduct(value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvalidProductError("商品の識別情報・日時・画像キーが不正です");
  }

  return Product.restore(result.data);
}
