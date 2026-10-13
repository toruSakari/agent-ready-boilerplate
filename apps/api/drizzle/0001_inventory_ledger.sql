CREATE TABLE `inventory_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`sku` text NOT NULL,
	`quantity` integer NOT NULL,
	`committed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_allocations_sku_idx` ON `inventory_allocations` (`sku`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`sku` text PRIMARY KEY NOT NULL,
	`on_hand` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `inventory_items` (`sku`, `on_hand`, `updated_at`)
VALUES ('SKU-EDGE-MUG', 25, '2026-09-30T00:00:00.000Z');
