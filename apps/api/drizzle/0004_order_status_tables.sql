CREATE TABLE `order_status_assignments` (
	`order_id` text PRIMARY KEY NOT NULL,
	`status_code` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`status_code`) REFERENCES `order_statuses`(`code`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `order_status_assignments_status_idx` ON `order_status_assignments` (`status_code`);--> statement-breakpoint
CREATE TABLE `order_statuses` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL
);
