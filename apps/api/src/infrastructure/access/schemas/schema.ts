import { sql } from "drizzle-orm";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  invitationsEnabled: integer("invitations_enabled", { mode: "boolean" }).notNull(),
  businessIpRestrictionEnabled: integer("business_ip_restriction_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  businessAllowedIps: text("business_allowed_ips").notNull().default("[]"),
  // 企業担当者のプランは個々の会員ではなく、この企業が所有する。
  planCode: text("plan_code"),
});
// 0014以前の読み取り専用履歴。実行時の本人解決には以下のサービス別会員テーブルを使う。
export const legacyAccounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  deleted: integer("deleted", { mode: "boolean" }).notNull(),
});
export const accessRoles = sqliteTable("access_roles", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  name: text("name").notNull(),
  protectedRole: integer("protected_role", { mode: "boolean" }).notNull(),
});
export const permissions = sqliteTable("permissions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
});
export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: text("id").primaryKey(),
    accessRolesId: text("access_roles_id")
      .notNull()
      .references(() => accessRoles.id),
    permissionsId: text("permissions_id")
      .notNull()
      .references(() => permissions.code),
  },
  (t) => [uniqueIndex("role_permission_unique").on(t.accessRolesId, t.permissionsId)],
);
export const legacyMemberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    accountsId: text("accounts_id")
      .notNull()
      .references(() => legacyAccounts.id),
    accessRolesId: text("access_roles_id")
      .notNull()
      .references(() => accessRoles.id),
  },
  (t) => [uniqueIndex("membership_scope_user").on(t.scope, t.accountsId)],
);
export const legacyActorQualifications = sqliteTable(
  "actor_qualifications",
  {
    id: text("id").primaryKey(),
    membershipsId: text("memberships_id")
      .notNull()
      .references(() => legacyMemberships.id, { onDelete: "cascade" }),
    actorKind: text("actor_kind", { enum: ["operator", "business", "customer"] }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull(),
  },
  (t) => [
    uniqueIndex("actor_qualification_membership_kind").on(t.membershipsId, t.actorKind),
    check("actor_qualification_kind", sql`${t.actorKind} IN ('operator','business','customer')`),
    check("actor_qualification_active", sql`${t.active} IN (0,1)`),
  ],
);
export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  email: text("email").notNull(),
  accessRolesId: text("access_roles_id")
    .notNull()
    .references(() => accessRoles.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  inviterId: text("inviter_id").notNull(),
  // NULLは旧招待を示す。種別を推測して承諾させず、分類後に再発行する。
  actorKind: text("actor_kind", { enum: ["operator", "business", "customer"] }),
  inviterChannel: text("inviter_channel", { enum: ["admin", "business"] }),
});
// サービスをまたぐ権限変更も、この共通revisionで認可時の状態との競合を検出する。
export const accessRevision = sqliteTable("access_revision", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  mutationId: text("mutation_id").notNull(),
});
export const auditEntries = sqliteTable("access_audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  scope: text("scope").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  occurredAt: text("occurred_at").notNull(),
});

// 同じsubjectでもサービス会員は別行。退会行を残し、有効行だけの一意制約で再登録を許す。
export const customerAccounts = sqliteTable(
  "customer_accounts",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    deleted: integer("deleted", { mode: "boolean" }).notNull(),
    // 一般ユーザーの個人プランは企業所属から独立し、再登録した別会員へは継承しない。
    planCode: text("plan_code"),
  },
  (t) => [
    uniqueIndex("customer_active_subject")
      .on(t.subjectId)
      .where(sql`${t.deleted} = 0`),
    check(
      "customer_account_id",
      sql`${t.id} GLOB 'customer:*' AND ${t.id} NOT GLOB '*[^A-Za-z0-9:_-]*' AND ${t.id} <> ${t.subjectId} AND ${t.id} = trim(${t.id}) AND length(${t.id}) > length('customer:') AND length(${t.id}) <= ${sql.raw(String(ACCESS_LIMITS.idMaxLength))}`,
    ),
    check("customer_account_deleted", sql`${t.deleted} IN (0,1)`),
  ],
);
// 適用済みDBの互換用に定義を保持する。新規の所属は作らず、移行0019で旧データを解消する。
export const customerMemberships = sqliteTable(
  "customer_memberships",
  {
    id: text("id").primaryKey(),
    organizationsId: text("organizations_id")
      .notNull()
      .references(() => organizations.id),
    customerAccountsId: text("customer_accounts_id")
      .notNull()
      .references(() => customerAccounts.id),
    accessRolesId: text("access_roles_id")
      .notNull()
      .references(() => accessRoles.id),
  },
  (t) => [
    uniqueIndex("customer_membership_scope_account").on(t.organizationsId, t.customerAccountsId),
    check(
      "customer_membership_id",
      sql`${t.id} GLOB 'customer:*' AND ${t.id} NOT GLOB '*[^A-Za-z0-9:_-]*' AND ${t.id} = trim(${t.id}) AND length(${t.id}) > length('customer:') AND length(${t.id}) <= ${sql.raw(String(ACCESS_LIMITS.idMaxLength))}`,
    ),
    check("customer_membership_scope", sql`${t.organizationsId} <> 'platform'`),
  ],
);

export const businessAccounts = sqliteTable(
  "business_accounts",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    deleted: integer("deleted", { mode: "boolean" }).notNull(),
  },
  (t) => [
    uniqueIndex("business_active_subject")
      .on(t.subjectId)
      .where(sql`${t.deleted} = 0`),
    check(
      "business_account_id",
      sql`${t.id} GLOB 'business:*' AND ${t.id} NOT GLOB '*[^A-Za-z0-9:_-]*' AND ${t.id} <> ${t.subjectId} AND ${t.id} = trim(${t.id}) AND length(${t.id}) > length('customer:') AND length(${t.id}) <= ${sql.raw(String(ACCESS_LIMITS.idMaxLength))}`,
    ),
    check("business_account_deleted", sql`${t.deleted} IN (0,1)`),
  ],
);
export const businessMemberships = sqliteTable(
  "business_memberships",
  {
    id: text("id").primaryKey(),
    organizationsId: text("organizations_id")
      .notNull()
      .references(() => organizations.id),
    businessAccountsId: text("business_accounts_id")
      .notNull()
      .references(() => businessAccounts.id),
    accessRolesId: text("access_roles_id")
      .notNull()
      .references(() => accessRoles.id),
  },
  (t) => [
    uniqueIndex("business_membership_scope_account").on(t.organizationsId, t.businessAccountsId),
    check(
      "business_membership_id",
      sql`${t.id} GLOB 'business:*' AND ${t.id} NOT GLOB '*[^A-Za-z0-9:_-]*' AND ${t.id} = trim(${t.id}) AND length(${t.id}) > length('customer:') AND length(${t.id}) <= ${sql.raw(String(ACCESS_LIMITS.idMaxLength))}`,
    ),
    check("business_membership_scope", sql`${t.organizationsId} <> 'platform'`),
  ],
);

export const operatorAccounts = sqliteTable(
  "operator_accounts",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    deleted: integer("deleted", { mode: "boolean" }).notNull(),
  },
  (t) => [
    uniqueIndex("operator_active_subject")
      .on(t.subjectId)
      .where(sql`${t.deleted} = 0`),
    check(
      "operator_account_id",
      sql`${t.id} GLOB 'operator:*' AND ${t.id} NOT GLOB '*[^A-Za-z0-9:_-]*' AND ${t.id} <> ${t.subjectId} AND ${t.id} = trim(${t.id}) AND length(${t.id}) > length('customer:') AND length(${t.id}) <= ${sql.raw(String(ACCESS_LIMITS.idMaxLength))}`,
    ),
    check("operator_account_deleted", sql`${t.deleted} IN (0,1)`),
  ],
);
export const operatorMemberships = sqliteTable(
  "operator_memberships",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    operatorAccountsId: text("operator_accounts_id")
      .notNull()
      .references(() => operatorAccounts.id),
    accessRolesId: text("access_roles_id")
      .notNull()
      .references(() => accessRoles.id),
  },
  (t) => [
    uniqueIndex("operator_membership_scope_account").on(t.scope, t.operatorAccountsId),
    check(
      "operator_membership_id",
      sql`${t.id} GLOB 'operator:*' AND ${t.id} NOT GLOB '*[^A-Za-z0-9:_-]*' AND ${t.id} = trim(${t.id}) AND length(${t.id}) > length('customer:') AND length(${t.id}) <= ${sql.raw(String(ACCESS_LIMITS.idMaxLength))}`,
    ),
    check("operator_membership_scope", sql`${t.scope} = 'platform'`),
  ],
);

// 前進移行0014で承認した帰属の証跡。実行時の会員登録には使わず、移行後も保持する。
export const serviceAccountMigrationMap = sqliteTable(
  "service_account_migration_map",
  {
    id: text("id").primaryKey(),
    legacyAccountId: text("legacy_account_id").notNull(),
    category: text("category", { enum: ["customer", "business", "operator"] }).notNull(),
    accountId: text("account_id").notNull().unique(),
    subjectId: text("subject_id").notNull(),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: text("reviewed_at").notNull(),
  },
  (t) => [
    uniqueIndex("service_account_legacy_category").on(t.legacyAccountId, t.category),
    check("service_account_map_category", sql`${t.category} IN ('customer','business','operator')`),
  ],
);
export const serviceMembershipMigrationMap = sqliteTable(
  "service_membership_migration_map",
  {
    id: text("id").primaryKey(),
    legacyMembershipId: text("legacy_membership_id").notNull(),
    accountId: text("account_id").notNull(),
    membershipId: text("membership_id").notNull().unique(),
    accessRolesId: text("access_roles_id")
      .notNull()
      .references(() => accessRoles.id),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: text("reviewed_at").notNull(),
  },
  (t) => [
    uniqueIndex("service_membership_legacy_account").on(t.legacyMembershipId, t.accountId),
    check("service_membership_map_enabled", sql`${t.enabled} IN (0,1)`),
  ],
);
export const serviceOrderMigrationMap = sqliteTable("service_order_migration_map", {
  ordersId: text("orders_id").primaryKey(),
  accountId: text("account_id").notNull(),
  reviewedBy: text("reviewed_by").notNull(),
  reviewedAt: text("reviewed_at").notNull(),
});
export const serviceAuditMigrationMap = sqliteTable("service_audit_migration_map", {
  auditId: text("audit_id").primaryKey(),
  actorAccountId: text("actor_account_id").notNull(),
  targetAccountId: text("target_account_id"),
  reviewedBy: text("reviewed_by").notNull(),
  reviewedAt: text("reviewed_at").notNull(),
});
export const legacyAuditEntries = sqliteTable("access_audit_legacy", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  scope: text("scope").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  occurredAt: text("occurred_at").notNull(),
});
