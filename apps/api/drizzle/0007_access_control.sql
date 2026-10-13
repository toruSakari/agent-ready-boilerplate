CREATE TABLE `access_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`mutation_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `access_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`protected_role` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`deleted` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `access_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`scope` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`email` text NOT NULL,
	`role_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `access_roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `access_roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_scope_user` ON `memberships` (`scope`,`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer NOT NULL,
	`invitations_enabled` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`permission` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `access_roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permission`) REFERENCES `permissions`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_permission_unique` ON `role_permissions` (`role_id`,`permission`);--> statement-breakpoint
DROP INDEX `inventory_allocations_sku_idx`;--> statement-breakpoint
ALTER TABLE `inventory_allocations` ADD `tenant_id` text DEFAULT 'demo-store' NOT NULL;--> statement-breakpoint
CREATE INDEX `inventory_allocations_sku_idx` ON `inventory_allocations` (`tenant_id`,`sku`);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `tenant_id` text DEFAULT 'demo-store' NOT NULL;