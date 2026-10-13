CREATE INDEX `orders_tenant_cursor_idx` ON `orders` (`tenant_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `orders_customer_cursor_idx` ON `orders` (`tenant_id`,`customer_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `products_tenant_cursor_idx` ON `products` (`tenant_id`,"created_at" desc,`id`);