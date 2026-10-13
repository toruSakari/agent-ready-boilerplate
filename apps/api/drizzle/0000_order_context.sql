CREATE TABLE `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `customer_id` text NOT NULL,
  `status` text NOT NULL,
  `lines` text NOT NULL,
  `total` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
  `id` text PRIMARY KEY NOT NULL,
  `aggregate_id` text NOT NULL,
  `event_type` text NOT NULL,
  `payload` text NOT NULL,
  `occurred_at` text NOT NULL,
  `published_at` text
);
--> statement-breakpoint
CREATE INDEX `orders_tenant_created_idx`
ON `orders` (`tenant_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `outbox_unpublished_idx`
ON `outbox_events` (`published_at`, `occurred_at`);
