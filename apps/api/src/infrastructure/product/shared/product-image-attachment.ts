import { and, eq, ne, exists, gt, lt, count, sql, or, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { ProductImageWriteCondition } from "#api/domain/product/repositories/product-repository.ts";
import type { ProductImageSnapshot } from "#api/domain/product/entities/product.ts";
import { products, productImages } from "#api/infrastructure/product/schemas/schema.ts";
import { PRODUCT_IMAGE_MAX_COUNT } from "#api/domain/product/entities/product.ts";

export type ProductImageAttachment = ProductImageWriteCondition &
  Readonly<{
    tenantId: string;
    productId: string;
    image: ProductImageSnapshot;
    imageKey: string | null;
    replace: boolean;
  }>;

function productGuard(db: DrizzleD1Database, input: ProductImageAttachment) {
  return exists(
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
  );
}

function attachedGuard(db: DrizzleD1Database, input: ProductImageAttachment, mutationId: string) {
  const next = alias(productImages, "next_image");
  return exists(
    db
      .select({ id: next.id })
      .from(next)
      .where(
        and(
          eq(next.id, input.image.id),
          eq(next.tenantId, input.tenantId),
          eq(next.productsId, input.productId),
          eq(next.state, "active"),
          eq(next.mutationId, mutationId),
        ),
      ),
  );
}

export function activateStagedImage(
  db: DrizzleD1Database,
  input: ProductImageAttachment,
  mutationId: string,
) {
  const current = alias(productImages, "current_images");
  const total = db
    .select({ total: count() })
    .from(current)
    .where(
      and(
        eq(current.tenantId, input.tenantId),
        eq(current.productsId, input.productId),
        eq(current.state, "active"),
      ),
    );
  return db
    .update(productImages)
    .set({ state: "active", deleteAfter: null, mutationId })
    .where(
      and(
        eq(productImages.id, input.image.id),
        eq(productImages.tenantId, input.tenantId),
        eq(productImages.productsId, input.productId),
        eq(productImages.state, "staged"),
        eq(productImages.key, input.image.key),
        eq(productImages.createdAt, input.image.createdAt),
        gt(productImages.deleteAfter, input.now),
        productGuard(db, input),
        or(
          input.replace && input.expectedKey !== null ? sql`1` : undefined,
          lt(sql`(${total})`, PRODUCT_IMAGE_MAX_COUNT),
        ),
      ),
    )
    .returning({ id: productImages.id });
}

export function retireReplacedImage(
  db: DrizzleD1Database,
  input: ProductImageAttachment,
  mutationId: string,
) {
  return db
    .update(productImages)
    .set({ state: "retired", removedAt: input.now, deleteAfter: input.deleteAfter })
    .where(
      and(
        eq(productImages.tenantId, input.tenantId),
        eq(productImages.productsId, input.productId),
        sql`${productImages.key} = ${input.expectedKey}`,
        ne(productImages.id, input.image.id),
        eq(productImages.state, "active"),
        sql`${Number(input.replace)}=1`,
        attachedGuard(db, input, mutationId),
        productGuard(db, input),
      ),
    );
}

export function selectPrimaryImage(
  db: DrizzleD1Database,
  input: ProductImageAttachment,
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
        or(input.replace ? sql`1` : undefined, isNull(products.imageKey)),
        attachedGuard(db, input, mutationId),
      ),
    );
}
