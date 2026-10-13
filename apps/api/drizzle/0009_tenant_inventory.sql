PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inventory_items` (
	`tenant_id` text DEFAULT 'demo-store' NOT NULL,
	`sku` text NOT NULL,
	`on_hand` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`tenant_id`, `sku`)
);
--> statement-breakpoint
INSERT INTO `__new_inventory_items`("tenant_id", "sku", "on_hand", "updated_at") SELECT "tenant_id", "sku", "on_hand", "updated_at" FROM `inventory_items`;--> statement-breakpoint
DROP TABLE `inventory_items`;--> statement-breakpoint
ALTER TABLE `__new_inventory_items` RENAME TO `inventory_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;