import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    orderId: text("order_id").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", {
      enum: ["pending", "authorized", "captured", "failed", "voided"],
    }).notNull(),
    authorizationId: text("authorization_id"),
    // 同じ注文のイベント再配送・順序逆転を判定するための版で、決済独自の更新番号ではない。
    orderVersion: integer("order_version").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("payments_tenant_order_idx").on(table.tenantId, table.orderId)],
);
