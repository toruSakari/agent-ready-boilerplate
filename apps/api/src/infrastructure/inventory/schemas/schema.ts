import { DEFAULT_LEGACY_INVENTORY_TENANT_ID } from "#api/infrastructure/inventory/shared/inventory-scope.ts";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryAdjustments = sqliteTable(
  "inventory_adjustments",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    sku: text("sku").notNull(),
    actorId: text("actor_id").notNull(),
    operation: text("operation", { enum: ["initial", "receive", "recount"] }).notNull(),
    reason: text("reason", {
      enum: ["initial", "delivery", "return", "stocktake", "damage", "correction"],
    }).notNull(),
    quantity: integer("quantity").notNull(),
    beforeStock: integer("before_stock").notNull(),
    afterStock: integer("after_stock").notNull(),
    expectedStock: integer("expected_stock"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("inventory_adjustments_cursor_idx").on(
      table.tenantId,
      table.sku,
      table.createdAt,
      table.id,
    ),
  ],
);

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    tenantId: text("tenant_id").notNull().default(DEFAULT_LEGACY_INVENTORY_TENANT_ID),
    sku: text("sku").notNull(),
    onHand: integer("on_hand").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.sku] })],
);

// 復元後も割当を残し、Queueの再配送による在庫の二重減算・二重復元を防ぐ証跡にする。
export const inventoryAllocations = sqliteTable(
  "inventory_allocations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default(DEFAULT_LEGACY_INVENTORY_TENANT_ID),
    orderId: text("order_id").notNull(),
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull(),
    restoredAt: text("restored_at"),
    committedAt: text("committed_at").notNull(),
  },
  (table) => [index("inventory_allocations_sku_idx").on(table.tenantId, table.sku)],
);
