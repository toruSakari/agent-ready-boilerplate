CREATE TABLE `actor_qualifications` (
	`id` text PRIMARY KEY NOT NULL,
	`memberships_id` text NOT NULL,
	`actor_kind` text NOT NULL,
	`active` integer NOT NULL,
	FOREIGN KEY (`memberships_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "actor_qualification_kind" CHECK("actor_qualifications"."actor_kind" IN ('operator','business','customer')),
	CONSTRAINT "actor_qualification_active" CHECK("actor_qualifications"."active" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actor_qualification_membership_kind` ON `actor_qualifications` (`memberships_id`,`actor_kind`);--> statement-breakpoint
ALTER TABLE `invitations` ADD `actor_kind` text;--> statement-breakpoint
ALTER TABLE `invitations` ADD `inviter_channel` text;