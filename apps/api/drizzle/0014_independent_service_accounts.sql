-- One-way 0014 cutover. Stop all writers, back up DB, prepare reviewed maps using tooling/service-account-migration-map.sql.
-- Existing 0013 qualifications are preserved only as history and never grant service enrollment.
-- D1 applies this migration atomically. Do not execute individual statements against a populated live DB.
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
--> statement-breakpoint
CREATE TABLE service_account_migration_gate (ready integer NOT NULL CHECK(ready=1));
--> statement-breakpoint
-- Fail closed: unmapped_accounts. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM accounts a WHERE NOT EXISTS (SELECT 1 FROM service_account_migration_map m WHERE m.legacy_account_id=a.id)) THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: invalid_account_mapping. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM service_account_migration_map m LEFT JOIN accounts a ON a.id=m.legacy_account_id WHERE a.id IS NULL OR m.category NOT IN ('customer','business','operator') OR m.account_id NOT GLOB m.category||':*' OR m.account_id GLOB '*[^A-Za-z0-9:_-]*' OR m.account_id<>trim(m.account_id) OR length(m.account_id)<=length(m.category)+1 OR length(m.account_id)>200 OR m.account_id=m.subject_id OR trim(m.subject_id)='' OR trim(m.reviewed_by)='' OR trim(m.reviewed_at)='') THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: duplicate_active_subject. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM service_account_migration_map m JOIN accounts a ON a.id=m.legacy_account_id WHERE a.deleted=0 GROUP BY m.category,m.subject_id HAVING COUNT(*)>1) THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: unmapped_memberships. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM memberships m WHERE NOT EXISTS (SELECT 1 FROM service_membership_migration_map x WHERE x.legacy_membership_id=m.id)) THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: invalid_membership_mapping. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM service_membership_migration_map x LEFT JOIN memberships m ON m.id=x.legacy_membership_id LEFT JOIN service_account_migration_map a ON a.account_id=x.account_id AND a.legacy_account_id=m.accounts_id LEFT JOIN accounts old ON old.id=a.legacy_account_id LEFT JOIN access_roles r ON r.id=x.access_roles_id AND r.scope=m.scope LEFT JOIN organizations o ON o.id=m.scope WHERE m.id IS NULL OR a.id IS NULL OR r.id IS NULL OR x.membership_id NOT GLOB a.category||':*' OR x.membership_id GLOB '*[^A-Za-z0-9:_-]*' OR x.membership_id<>trim(x.membership_id) OR length(x.membership_id)<=length(a.category)+1 OR length(x.membership_id)>200 OR x.access_roles_id GLOB '*[^A-Za-z0-9:_-]*' OR x.access_roles_id<>trim(x.access_roles_id) OR length(x.access_roles_id) NOT BETWEEN 1 AND 200 OR x.enabled NOT IN (0,1) OR trim(x.reviewed_by)='' OR trim(x.reviewed_at)='' OR (x.enabled=1 AND (old.deleted<>0 OR (a.category='customer' AND (r.protected_role<>0 OR EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.access_roles_id=r.id AND rp.permissions_id NOT IN ('order:read','order:create','order:update','product.read')))) OR (a.category='operator' AND m.scope<>'platform') OR (a.category<>'operator' AND (m.scope='platform' OR o.id IS NULL))))) THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: unmapped_orders. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM orders o WHERE NOT EXISTS (SELECT 1 FROM service_order_migration_map x WHERE x.orders_id=o.id)) THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: invalid_order_mapping. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM service_order_migration_map x LEFT JOIN orders o ON o.id=x.orders_id LEFT JOIN service_account_migration_map a ON a.account_id=x.account_id AND a.legacy_account_id=o.customer_id WHERE o.id IS NULL OR a.id IS NULL OR a.category='operator' OR trim(x.reviewed_by)='' OR trim(x.reviewed_at)='') THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: unmapped_audits. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM access_audit a WHERE NOT EXISTS (SELECT 1 FROM service_audit_migration_map x WHERE x.audit_id=a.id)) THEN 1 ELSE 0 END;
--> statement-breakpoint
-- Fail closed: invalid_audit_mapping. Review maps; do not infer category from roles, permissions, names, or 0013 qualifications.
INSERT INTO service_account_migration_gate SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM service_audit_migration_map x LEFT JOIN access_audit a ON a.id=x.audit_id LEFT JOIN service_account_migration_map actor ON actor.account_id=x.actor_account_id AND actor.legacy_account_id=a.actor_id LEFT JOIN service_account_migration_map target ON target.account_id=x.target_account_id AND target.legacy_account_id=a.target_id WHERE a.id IS NULL OR actor.id IS NULL OR (x.target_account_id IS NOT NULL AND target.id IS NULL) OR (a.action IN ('member.remove','user.delete','account.delete','account.withdraw') AND target.id IS NULL) OR trim(x.reviewed_by)='' OR trim(x.reviewed_at)='') THEN 1 ELSE 0 END;
--> statement-breakpoint
DROP TABLE service_account_migration_gate;
--> statement-breakpoint
CREATE TABLE `business_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`deleted` integer NOT NULL,
	CONSTRAINT "business_account_id" CHECK("business_accounts"."id" GLOB 'business:*' AND "business_accounts"."id" NOT GLOB '*[^A-Za-z0-9:_-]*' AND "business_accounts"."id" <> "business_accounts"."subject_id" AND "business_accounts"."id" = trim("business_accounts"."id") AND length("business_accounts"."id") > length('customer:') AND length("business_accounts"."id") <= 200),
	CONSTRAINT "business_account_deleted" CHECK("business_accounts"."deleted" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_active_subject` ON `business_accounts` (`subject_id`) WHERE "business_accounts"."deleted" = 0;
--> statement-breakpoint
CREATE TABLE `business_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organizations_id` text NOT NULL,
	`business_accounts_id` text NOT NULL,
	`access_roles_id` text NOT NULL,
	FOREIGN KEY (`organizations_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_accounts_id`) REFERENCES `business_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`access_roles_id`) REFERENCES `access_roles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "business_membership_id" CHECK("business_memberships"."id" GLOB 'business:*' AND "business_memberships"."id" NOT GLOB '*[^A-Za-z0-9:_-]*' AND "business_memberships"."id" = trim("business_memberships"."id") AND length("business_memberships"."id") > length('customer:') AND length("business_memberships"."id") <= 200),
	CONSTRAINT "business_membership_scope" CHECK("business_memberships"."organizations_id" <> 'platform')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_membership_scope_account` ON `business_memberships` (`organizations_id`,`business_accounts_id`);
--> statement-breakpoint
CREATE TABLE `customer_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`deleted` integer NOT NULL,
	CONSTRAINT "customer_account_id" CHECK("customer_accounts"."id" GLOB 'customer:*' AND "customer_accounts"."id" NOT GLOB '*[^A-Za-z0-9:_-]*' AND "customer_accounts"."id" <> "customer_accounts"."subject_id" AND "customer_accounts"."id" = trim("customer_accounts"."id") AND length("customer_accounts"."id") > length('customer:') AND length("customer_accounts"."id") <= 200),
	CONSTRAINT "customer_account_deleted" CHECK("customer_accounts"."deleted" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_active_subject` ON `customer_accounts` (`subject_id`) WHERE "customer_accounts"."deleted" = 0;
--> statement-breakpoint
CREATE TABLE `customer_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organizations_id` text NOT NULL,
	`customer_accounts_id` text NOT NULL,
	`access_roles_id` text NOT NULL,
	FOREIGN KEY (`organizations_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_accounts_id`) REFERENCES `customer_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`access_roles_id`) REFERENCES `access_roles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customer_membership_id" CHECK("customer_memberships"."id" GLOB 'customer:*' AND "customer_memberships"."id" NOT GLOB '*[^A-Za-z0-9:_-]*' AND "customer_memberships"."id" = trim("customer_memberships"."id") AND length("customer_memberships"."id") > length('customer:') AND length("customer_memberships"."id") <= 200),
	CONSTRAINT "customer_membership_scope" CHECK("customer_memberships"."organizations_id" <> 'platform')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_membership_scope_account` ON `customer_memberships` (`organizations_id`,`customer_accounts_id`);
--> statement-breakpoint
CREATE TABLE `access_audit_legacy` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`scope` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`deleted` integer NOT NULL,
	CONSTRAINT "operator_account_id" CHECK("operator_accounts"."id" GLOB 'operator:*' AND "operator_accounts"."id" NOT GLOB '*[^A-Za-z0-9:_-]*' AND "operator_accounts"."id" <> "operator_accounts"."subject_id" AND "operator_accounts"."id" = trim("operator_accounts"."id") AND length("operator_accounts"."id") > length('customer:') AND length("operator_accounts"."id") <= 200),
	CONSTRAINT "operator_account_deleted" CHECK("operator_accounts"."deleted" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_active_subject` ON `operator_accounts` (`subject_id`) WHERE "operator_accounts"."deleted" = 0;
--> statement-breakpoint
CREATE TABLE `operator_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`operator_accounts_id` text NOT NULL,
	`access_roles_id` text NOT NULL,
	FOREIGN KEY (`operator_accounts_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`access_roles_id`) REFERENCES `access_roles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "operator_membership_id" CHECK("operator_memberships"."id" GLOB 'operator:*' AND "operator_memberships"."id" NOT GLOB '*[^A-Za-z0-9:_-]*' AND "operator_memberships"."id" = trim("operator_memberships"."id") AND length("operator_memberships"."id") > length('customer:') AND length("operator_memberships"."id") <= 200),
	CONSTRAINT "operator_membership_scope" CHECK("operator_memberships"."scope" = 'platform')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_membership_scope_account` ON `operator_memberships` (`scope`,`operator_accounts_id`);
--> statement-breakpoint
CREATE TRIGGER customer_membership_role_scope_insert BEFORE INSERT ON customer_memberships WHEN NOT EXISTS (SELECT 1 FROM access_roles WHERE id=NEW.access_roles_id AND scope=NEW.organizations_id) BEGIN SELECT RAISE(ABORT, 'membership role scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER customer_membership_active_account_insert BEFORE INSERT ON customer_memberships WHEN NOT EXISTS (SELECT 1 FROM customer_accounts WHERE id=NEW.customer_accounts_id AND deleted=0) BEGIN SELECT RAISE(ABORT, 'membership requires active service account'); END;
--> statement-breakpoint
CREATE TRIGGER customer_membership_role_scope_update BEFORE UPDATE ON customer_memberships WHEN NOT EXISTS (SELECT 1 FROM access_roles WHERE id=NEW.access_roles_id AND scope=NEW.organizations_id) BEGIN SELECT RAISE(ABORT, 'membership role scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER customer_membership_active_account_update BEFORE UPDATE ON customer_memberships WHEN NOT EXISTS (SELECT 1 FROM customer_accounts WHERE id=NEW.customer_accounts_id AND deleted=0) BEGIN SELECT RAISE(ABORT, 'membership requires active service account'); END;
--> statement-breakpoint
CREATE TRIGGER customer_account_identity_immutable BEFORE UPDATE ON customer_accounts WHEN NEW.id<>OLD.id OR NEW.subject_id<>OLD.subject_id OR (OLD.deleted=1 AND NEW.deleted=0) BEGIN SELECT RAISE(ABORT, 'service account identity and tombstones are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER business_membership_role_scope_insert BEFORE INSERT ON business_memberships WHEN NOT EXISTS (SELECT 1 FROM access_roles WHERE id=NEW.access_roles_id AND scope=NEW.organizations_id) BEGIN SELECT RAISE(ABORT, 'membership role scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER business_membership_active_account_insert BEFORE INSERT ON business_memberships WHEN NOT EXISTS (SELECT 1 FROM business_accounts WHERE id=NEW.business_accounts_id AND deleted=0) BEGIN SELECT RAISE(ABORT, 'membership requires active service account'); END;
--> statement-breakpoint
CREATE TRIGGER business_membership_role_scope_update BEFORE UPDATE ON business_memberships WHEN NOT EXISTS (SELECT 1 FROM access_roles WHERE id=NEW.access_roles_id AND scope=NEW.organizations_id) BEGIN SELECT RAISE(ABORT, 'membership role scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER business_membership_active_account_update BEFORE UPDATE ON business_memberships WHEN NOT EXISTS (SELECT 1 FROM business_accounts WHERE id=NEW.business_accounts_id AND deleted=0) BEGIN SELECT RAISE(ABORT, 'membership requires active service account'); END;
--> statement-breakpoint
CREATE TRIGGER business_account_identity_immutable BEFORE UPDATE ON business_accounts WHEN NEW.id<>OLD.id OR NEW.subject_id<>OLD.subject_id OR (OLD.deleted=1 AND NEW.deleted=0) BEGIN SELECT RAISE(ABORT, 'service account identity and tombstones are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER operator_membership_role_scope_insert BEFORE INSERT ON operator_memberships WHEN NOT EXISTS (SELECT 1 FROM access_roles WHERE id=NEW.access_roles_id AND scope=NEW.scope) BEGIN SELECT RAISE(ABORT, 'membership role scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER operator_membership_active_account_insert BEFORE INSERT ON operator_memberships WHEN NOT EXISTS (SELECT 1 FROM operator_accounts WHERE id=NEW.operator_accounts_id AND deleted=0) BEGIN SELECT RAISE(ABORT, 'membership requires active service account'); END;
--> statement-breakpoint
CREATE TRIGGER operator_membership_role_scope_update BEFORE UPDATE ON operator_memberships WHEN NOT EXISTS (SELECT 1 FROM access_roles WHERE id=NEW.access_roles_id AND scope=NEW.scope) BEGIN SELECT RAISE(ABORT, 'membership role scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER operator_membership_active_account_update BEFORE UPDATE ON operator_memberships WHEN NOT EXISTS (SELECT 1 FROM operator_accounts WHERE id=NEW.operator_accounts_id AND deleted=0) BEGIN SELECT RAISE(ABORT, 'membership requires active service account'); END;
--> statement-breakpoint
CREATE TRIGGER operator_account_identity_immutable BEFORE UPDATE ON operator_accounts WHEN NEW.id<>OLD.id OR NEW.subject_id<>OLD.subject_id OR (OLD.deleted=1 AND NEW.deleted=0) BEGIN SELECT RAISE(ABORT, 'service account identity and tombstones are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER access_role_scope_immutable BEFORE UPDATE OF scope ON access_roles WHEN NEW.scope<>OLD.scope BEGIN SELECT RAISE(ABORT, 'role scope is immutable'); END;
--> statement-breakpoint
INSERT INTO access_audit_legacy SELECT * FROM access_audit;
--> statement-breakpoint
INSERT INTO customer_accounts (id,subject_id,name,email,deleted) SELECT m.account_id,m.subject_id,a.name,a.email,a.deleted FROM service_account_migration_map m JOIN accounts a ON a.id=m.legacy_account_id WHERE m.category='customer';
--> statement-breakpoint
INSERT INTO customer_memberships (id,organizations_id,customer_accounts_id,access_roles_id) SELECT x.membership_id,m.scope,x.account_id,x.access_roles_id FROM service_membership_migration_map x JOIN memberships m ON m.id=x.legacy_membership_id JOIN service_account_migration_map a ON a.account_id=x.account_id WHERE a.category='customer' AND x.enabled=1;
--> statement-breakpoint
INSERT INTO business_accounts (id,subject_id,name,email,deleted) SELECT m.account_id,m.subject_id,a.name,a.email,a.deleted FROM service_account_migration_map m JOIN accounts a ON a.id=m.legacy_account_id WHERE m.category='business';
--> statement-breakpoint
INSERT INTO business_memberships (id,organizations_id,business_accounts_id,access_roles_id) SELECT x.membership_id,m.scope,x.account_id,x.access_roles_id FROM service_membership_migration_map x JOIN memberships m ON m.id=x.legacy_membership_id JOIN service_account_migration_map a ON a.account_id=x.account_id WHERE a.category='business' AND x.enabled=1;
--> statement-breakpoint
INSERT INTO operator_accounts (id,subject_id,name,email,deleted) SELECT m.account_id,m.subject_id,a.name,a.email,a.deleted FROM service_account_migration_map m JOIN accounts a ON a.id=m.legacy_account_id WHERE m.category='operator';
--> statement-breakpoint
INSERT INTO operator_memberships (id,scope,operator_accounts_id,access_roles_id) SELECT x.membership_id,m.scope,x.account_id,x.access_roles_id FROM service_membership_migration_map x JOIN memberships m ON m.id=x.legacy_membership_id JOIN service_account_migration_map a ON a.account_id=x.account_id WHERE a.category='operator' AND x.enabled=1;
--> statement-breakpoint
UPDATE orders SET customer_id=(SELECT account_id FROM service_order_migration_map WHERE orders_id=orders.id);
--> statement-breakpoint
UPDATE access_audit SET actor_id=(SELECT actor_account_id FROM service_audit_migration_map WHERE audit_id=access_audit.id),target_id=COALESCE((SELECT target_account_id FROM service_audit_migration_map WHERE audit_id=access_audit.id),target_id);
--> statement-breakpoint
-- Existing invitation links cannot silently acquire service enrollment. Reissue after migration.
UPDATE invitations SET actor_kind=NULL,inviter_channel=NULL;
--> statement-breakpoint
UPDATE access_revision SET version=version+1,mutation_id='independent-service-accounts';
--> statement-breakpoint
CREATE TRIGGER accounts_archive_no_insert BEFORE INSERT ON accounts BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER accounts_archive_no_update BEFORE UPDATE ON accounts BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER accounts_archive_no_delete BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER memberships_archive_no_insert BEFORE INSERT ON memberships BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER memberships_archive_no_update BEFORE UPDATE ON memberships BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER memberships_archive_no_delete BEFORE DELETE ON memberships BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER actor_qualifications_archive_no_insert BEFORE INSERT ON actor_qualifications BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER actor_qualifications_archive_no_update BEFORE UPDATE ON actor_qualifications BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER actor_qualifications_archive_no_delete BEFORE DELETE ON actor_qualifications BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER access_audit_legacy_archive_no_insert BEFORE INSERT ON access_audit_legacy BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER access_audit_legacy_archive_no_update BEFORE UPDATE ON access_audit_legacy BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER access_audit_legacy_archive_no_delete BEFORE DELETE ON access_audit_legacy BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_account_migration_map_archive_no_insert BEFORE INSERT ON service_account_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_account_migration_map_archive_no_update BEFORE UPDATE ON service_account_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_account_migration_map_archive_no_delete BEFORE DELETE ON service_account_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_membership_migration_map_archive_no_insert BEFORE INSERT ON service_membership_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_membership_migration_map_archive_no_update BEFORE UPDATE ON service_membership_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_membership_migration_map_archive_no_delete BEFORE DELETE ON service_membership_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_order_migration_map_archive_no_insert BEFORE INSERT ON service_order_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_order_migration_map_archive_no_update BEFORE UPDATE ON service_order_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_order_migration_map_archive_no_delete BEFORE DELETE ON service_order_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_audit_migration_map_archive_no_insert BEFORE INSERT ON service_audit_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_audit_migration_map_archive_no_update BEFORE UPDATE ON service_audit_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER service_audit_migration_map_archive_no_delete BEFORE DELETE ON service_audit_migration_map BEGIN SELECT RAISE(ABORT, '0014 legacy identity archive is read-only'); END;
