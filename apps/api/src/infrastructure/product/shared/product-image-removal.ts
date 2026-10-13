import { and, eq, ne, exists, notExists, asc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { ProductImageWriteCondition } from "#api/domain/product/repositories/product-repository.ts";
import { products, productImages } from "#api/infrastructure/product/schemas/schema.ts";

type ProductImageRemoval = ProductImageWriteCondition &
  Readonly<{
    tenantId: string;
    productId: string;
    imageId: string;
    imageKey: string | null;
  }>;

function remainingPrimaryGuard(db: DrizzleD1Database, input: ProductImageRemoval) {
  const remaining = alias(productImages, "remaining_images");
  const active = db
    .select({ key: remaining.key })
    .from(remaining)
    .where(
      and(
        eq(remaining.tenantId, input.tenantId),
        eq(remaining.productsId, input.productId),
        eq(remaining.state, "active"),
        ne(remaining.id, input.imageId),
        input.imageKey !== null && input.imageKey === input.expectedKey
          ? eq(remaining.key, input.imageKey)
          : undefined,
      ),
    )
    .orderBy(asc(remaining.createdAt), asc(remaining.id))
    .limit(1);
  // 新しい代表は保存時点でも最初の残存画像でなければ競合にする。
  // 最後の一枚の読取後に追加された画像も、代表参照のない状態へ置き去りにしない。
  return input.imageKey === null ? notExists(active) : sql`${input.imageKey} is (${active})`;
}

export function retireRemovedImage(
  db: DrizzleD1Database,
  input: ProductImageRemoval,
  mutationId: string,
) {
  return db
    .update(productImages)
    .set({ state: "retired", removedAt: input.now, deleteAfter: input.deleteAfter, mutationId })
    .where(
      and(
        eq(productImages.id, input.imageId),
        eq(productImages.tenantId, input.tenantId),
        eq(productImages.productsId, input.productId),
        eq(productImages.state, "active"),
        // 代表画像以外の解除は代表を維持し、代表の解除だけが次の画像へ切り替えられる。
        input.imageKey === input.expectedKey
          ? sql`${productImages.key} is not ${input.expectedKey}`
          : sql`${productImages.key} is ${input.expectedKey}`,
        exists(
          db
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                eq(products.id, input.productId),
                eq(products.tenantId, input.tenantId),
                sql`${products.imageKey} is ${input.expectedKey}`,
              ),
            ),
        ),
        remainingPrimaryGuard(db, input),
      ),
    )
    .returning({ id: productImages.id });
}

export function selectRemainingImage(
  db: DrizzleD1Database,
  input: ProductImageRemoval,
  mutationId: string,
) {
  return db
    .update(products)
    .set({ imageKey: input.imageKey })
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.tenantId, input.tenantId),
        sql`${products.imageKey} is ${input.expectedKey}`,
        exists(
          db
            .select({ id: productImages.id })
            .from(productImages)
            .where(
              and(
                eq(productImages.id, input.imageId),
                eq(productImages.tenantId, input.tenantId),
                eq(productImages.productsId, input.productId),
                eq(productImages.state, "retired"),
                eq(productImages.mutationId, mutationId),
              ),
            ),
        ),
      ),
    );
}
