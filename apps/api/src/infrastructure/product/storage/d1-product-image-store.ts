import { drizzle } from "drizzle-orm/d1";
import { and, eq, exists, notExists } from "drizzle-orm";
import { products, productImages } from "#api/infrastructure/product/schemas/schema.ts";
import { guardedInsert } from "#api/infrastructure/shared/guarded-insert.ts";
import type {
  ProductImageStore,
  StageProductImageInput,
} from "#api/application/product/storage/product-image-store.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

export class D1ProductImageStore implements ProductImageStore {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async stageImage(input: StageProductImageInput) {
    // 削除済み行も照合し、清掃とキー再利用の競合を防ぐ。
    const guard = and(
      exists(
        this.db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.id, input.productId), eq(products.tenantId, input.tenantId))),
      ),
      notExists(
        this.db
          .select({ id: productImages.id })
          .from(productImages)
          .where(eq(productImages.key, input.image.key)),
      ),
      notExists(
        this.db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.imageKey, input.image.key)),
      ),
    )!;
    const rows = await guardedInsert(
      this.db,
      productImages,
      {
        id: input.image.id,
        tenantId: input.tenantId,
        productsId: input.productId,
        key: input.image.key,
        state: "staged",
        createdAt: input.image.createdAt,
        deleteAfter: input.deleteAfter,
      },
      guard,
    )
      .onConflictDoNothing()
      .returning({ id: productImages.id });
    if (rows.length !== 1) {
      throw new ApplicationError({ code: "CONFLICT", message: "商品画像を登録できませんでした" });
    }
  }
}
