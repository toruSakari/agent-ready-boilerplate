-- Populate the status master before migrating the existing order associations.
INSERT INTO order_statuses (code, name, sort_order) VALUES
  ('draft', '下書き', 10),
  ('confirmed', '確定', 20),
  ('shipped', '出荷済み', 30),
  ('completed', '完了', 40),
  ('cancelled', 'キャンセル済み', 50);
--> statement-breakpoint
INSERT INTO order_status_assignments (order_id, status_code, updated_at)
SELECT id, status, created_at FROM orders;
