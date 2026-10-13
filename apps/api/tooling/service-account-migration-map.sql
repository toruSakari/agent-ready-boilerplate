-- 移行0014で使う承認済みの対応表。実データのあるDBでは適用前に全対応を明示的に入力する。
-- このDDLだけでは帰属を決めない。ロール名・メール・旧資格から新サービスを推測しない。
CREATE TABLE IF NOT EXISTS `service_account_migration_map` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_account_id` text NOT NULL,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text NOT NULL,
	CONSTRAINT "service_account_map_category" CHECK("service_account_migration_map"."category" IN ('customer','business','operator'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `service_account_migration_map_account_id_unique` ON `service_account_migration_map` (`account_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `service_account_legacy_category` ON `service_account_migration_map` (`legacy_account_id`,`category`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `service_audit_migration_map` (
	`audit_id` text PRIMARY KEY NOT NULL,
	`actor_account_id` text NOT NULL,
	`target_account_id` text,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `service_membership_migration_map` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_membership_id` text NOT NULL,
	`account_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`access_roles_id` text NOT NULL,
	`enabled` integer NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text NOT NULL,
	FOREIGN KEY (`access_roles_id`) REFERENCES `access_roles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "service_membership_map_enabled" CHECK("service_membership_migration_map"."enabled" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `service_membership_migration_map_membership_id_unique` ON `service_membership_migration_map` (`membership_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `service_membership_legacy_account` ON `service_membership_migration_map` (`legacy_membership_id`,`account_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `service_order_migration_map` (
	`orders_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text NOT NULL
);
