import { ORDER_STATUS_CODES } from "#api/domain/order/policies/order-status.ts";
import { desc } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    customerId: text("customer_id").notNull(),
    lines: text("lines").notNull(),
    total: integer("total").notNull(),
    createdAt: text("created_at").notNull(),
    version: integer("version").notNull().default(0),
    reservationId: text("reservation_id"),
    // 版比較に成功した更新と、同じバッチの状態変更・Outbox追加を結び付ける。
    lastEventId: text("last_event_id"),
  },
  (table) => [
    index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("orders_tenant_cursor_idx").on(table.tenantId, desc(table.createdAt), table.id),
    index("orders_customer_cursor_idx").on(
      table.tenantId,
      table.customerId,
      desc(table.createdAt),
      table.id,
    ),
  ],
);

export const orderStatuses = sqliteTable("order_statuses", {
  code: text("code", {
    enum: ORDER_STATUS_CODES,
  }).primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

// 現在状態をマスター参照として1注文1行に保ち、表示名とドメインの状態コードを分ける。
export const orderStatusAssignments = sqliteTable(
  "order_status_assignments",
  {
    ordersId: text("orders_id")
      .primaryKey()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderStatusesId: text("order_statuses_id")
      .notNull()
      .references(() => orderStatuses.code, { onDelete: "restrict" }),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("order_status_assignments_status_idx").on(table.orderStatusesId)],
);

// Queueへ送る意図を注文と同じDBに持ち、外部送信との分散トランザクションを避ける。
export const outboxEvents = sqliteTable(
  "outbox_events",
  {
    id: text("id").primaryKey(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: text("payload").notNull(),
    occurredAt: text("occurred_at").notNull(),
    publishedAt: text("published_at"),
  },
  (table) => [index("outbox_unpublished_idx").on(table.publishedAt, table.occurredAt)],
);

export const orderEventHistory = sqliteTable(
  "order_event_history",
  {
    eventId: text("event_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    orderId: text("order_id").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: text("occurred_at").notNull(),
    processedAt: text("processed_at").notNull(),
  },
  (table) => [
    index("order_event_history_tenant_order").on(table.tenantId, table.orderId, table.occurredAt),
  ],
);
