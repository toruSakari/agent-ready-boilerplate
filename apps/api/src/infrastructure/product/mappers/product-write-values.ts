import type { Product } from "#api/domain/product/entities/product.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

/** 初回登録に画像参照を混ぜず、Productを商品INSERTの列へ変換する。 */
export function productWriteValues(product: Product) {
  const { images, ...row } = product.toSnapshot();
  if (row.imageKey !== null || images.length !== 0) {
    throw new ApplicationError({ code: "CONFLICT", message: "商品画像はアップロードしてください" });
  }

  return row;
}
