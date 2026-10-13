CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  image_key TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX products_tenant_sku ON products (tenant_id, sku);

CREATE TABLE order_event_history (
  event_id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
CREATE INDEX order_event_history_tenant_order ON order_event_history (tenant_id, order_id, occurred_at);
