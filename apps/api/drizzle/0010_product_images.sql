CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`product_id` text NOT NULL,
	`image_key` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`removed_at` text,
	`mutation_id` text,
	`delete_after` text,
	`claim_token` text,
	`claimed_until` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `product_images_product_state` ON `product_images` (`tenant_id`,`product_id`,`state`);--> statement-breakpoint
CREATE INDEX `product_images_key` ON `product_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `product_images_cleanup` ON `product_images` (`state`,`delete_after`,`claimed_until`);