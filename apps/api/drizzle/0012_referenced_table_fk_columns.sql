-- Custom migration: rename columns in place to preserve rows, indexes, and FK actions.
-- permissions_id and order_statuses_id keep their existing code values and TEXT types.
ALTER TABLE `memberships` RENAME COLUMN `user_id` TO `accounts_id`;--> statement-breakpoint
ALTER TABLE `memberships` RENAME COLUMN `role_id` TO `access_roles_id`;--> statement-breakpoint
ALTER TABLE `role_permissions` RENAME COLUMN `role_id` TO `access_roles_id`;--> statement-breakpoint
ALTER TABLE `role_permissions` RENAME COLUMN `permission` TO `permissions_id`;--> statement-breakpoint
ALTER TABLE `invitations` RENAME COLUMN `role_id` TO `access_roles_id`;--> statement-breakpoint
ALTER TABLE `order_status_assignments` RENAME COLUMN `order_id` TO `orders_id`;--> statement-breakpoint
ALTER TABLE `order_status_assignments` RENAME COLUMN `status_code` TO `order_statuses_id`;--> statement-breakpoint
ALTER TABLE `product_images` RENAME COLUMN `product_id` TO `products_id`;
