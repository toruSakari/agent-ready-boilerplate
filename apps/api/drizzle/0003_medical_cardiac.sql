CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`order_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`authorization_id` text,
	`order_version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payments_tenant_order_idx` ON `payments` (`tenant_id`,`order_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `reservation_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `last_event_id` text;--> statement-breakpoint
ALTER TABLE `inventory_allocations` ADD `restored_at` text;