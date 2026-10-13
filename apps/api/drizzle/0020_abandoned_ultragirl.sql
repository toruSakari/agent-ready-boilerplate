CREATE TABLE `inventory_adjustments` (
	`id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`sku` text NOT NULL,
	`actor_id` text NOT NULL,
	`operation` text NOT NULL,
	`reason` text NOT NULL,
	`quantity` integer NOT NULL,
	`before_stock` integer NOT NULL,
	`after_stock` integer NOT NULL,
	`expected_stock` integer,
	`created_at` text NOT NULL,
	PRIMARY KEY(`tenant_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `inventory_adjustments_cursor_idx` ON `inventory_adjustments` (`tenant_id`,`sku`,`created_at`,`id`);