import { desc } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    unitPrice: integer("unit_price").notNull(),
    imageKey: text("image_key"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("products_tenant_sku").on(table.tenantId, table.sku),
    index("products_tenant_cursor_idx").on(table.tenantId, desc(table.createdAt), table.id),
  ],
);

// 関連解除・削除後もキーの再利用を防ぐ履歴として行を残す。
// 旧商品はキーを共有し得るため、一意制約で履歴を拒否せず、
// stageImageの原子的なINSERT ... WHERE NOT EXISTSで新規キーの一意性を守る。
export const productImages = sqliteTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    productsId: text("products_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    key: text("image_key").notNull(),
    state: text("state", {
      enum: ["staged", "active", "retired", "deleting", "deleted"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
    removedAt: text("removed_at"),
    mutationId: text("mutation_id"),
    deleteAfter: text("delete_after"),
    claimToken: text("claim_token"),
    claimedUntil: text("claimed_until"),
  },
  (table) => [
    index("product_images_product_state").on(table.tenantId, table.productsId, table.state),
    index("product_images_key").on(table.key),
    index("product_images_cleanup").on(table.state, table.deleteAfter, table.claimedUntil),
  ],
);
