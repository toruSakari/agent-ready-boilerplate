import { drizzle } from "drizzle-orm/d1";
import { and, or, eq, lte, gt, asc, inArray, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { products, productImages } from "#api/infrastructure/product/schemas/schema.ts";
import { orders } from "#api/infrastructure/order/schemas/schema.ts";
import type {
  ClaimProductImageGarbageInput,
  ProductImageCleanupStore,
} from "#api/application/product/storage/product-image-cleanup-store.ts";

export class D1ProductImageCleanupStore implements ProductImageCleanupStore {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async claimImageGarbage(input: ClaimProductImageGarbageInput) {
    assertCleanupLease(input);

    const candidate = alias(productImages, "candidate");
    const reference = alias(productImages, "reference");
    const candidates = this.db
      .select({ id: candidate.id })
      .from(candidate)
      .where(
        and(
          lte(candidate.deleteAfter, input.now),
          or(
            inArray(candidate.state, ["staged", "retired"]),
            and(eq(candidate.state, "deleting"), lte(candidate.claimedUntil, input.now)),
          ),
          notExists(
            this.db
              .select({ id: products.id })
              .from(products)
              .where(eq(products.imageKey, candidate.key)),
          ),
          notExists(
            this.db
              .select({ id: reference.id })
              .from(reference)
              .where(
                and(
                  eq(reference.key, candidate.key),
                  or(eq(reference.state, "active"), gt(reference.deleteAfter, input.now)),
                ),
              ),
          ),
          notExists(
            this.db
              .select({ id: orders.id })
              .from(orders)
              .where(
                sql`not json_valid(${orders.lines}) or exists(select 1 from json_tree(case when json_valid(${orders.lines}) then ${orders.lines} else '[]' end) where type='text' and atom=${candidate.key})`,
              ),
          ),
        ),
      )
      .orderBy(asc(candidate.deleteAfter), asc(candidate.id))
      .limit(input.limit);
    // json_treeはSQLiteのテーブル値関数。無効JSONも参照の可能性として扱う。
    return this.db
      .update(productImages)
      .set({ state: "deleting", claimToken: input.claimToken, claimedUntil: input.leaseUntil })
      .where(inArray(productImages.id, candidates))
      .returning({ imageId: productImages.id, key: productImages.key });
  }

  async completeImageGarbage(input: { imageId: string; claimToken: string }) {
    await this.db
      .update(productImages)
      .set({ state: "deleted", claimToken: null, claimedUntil: null })
      .where(
        and(
          eq(productImages.id, input.imageId),
          eq(productImages.state, "deleting"),
          eq(productImages.claimToken, input.claimToken),
        ),
      );
  }
}

function assertCleanupLease(input: ClaimProductImageGarbageInput) {
  if (!Number.isInteger(input.limit) || input.limit <= 0 || input.leaseUntil <= input.now) {
    throw new Error("商品画像のクリーンアップ設定が不正です");
  }
}
