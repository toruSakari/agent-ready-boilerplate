// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { assertServiceAccountMigrationReady } from "@/apps/api/tooling/service-account-migration-guard";

const columns: Record<string, string[]> = {
  customer_accounts: ["id", "subject_id", "name", "email", "deleted"],
  business_accounts: ["id", "subject_id", "name", "email", "deleted"],
  operator_accounts: ["id", "subject_id", "name", "email", "deleted"],
  customer_memberships: ["id", "organizations_id", "customer_accounts_id", "access_roles_id"],
  business_memberships: ["id", "organizations_id", "business_accounts_id", "access_roles_id"],
  operator_memberships: ["id", "scope", "operator_accounts_id", "access_roles_id"],
  service_account_migration_map: [
    "legacy_account_id",
    "category",
    "account_id",
    "subject_id",
    "reviewed_by",
    "reviewed_at",
  ],
  service_membership_migration_map: [
    "legacy_membership_id",
    "account_id",
    "membership_id",
    "access_roles_id",
    "enabled",
    "reviewed_by",
    "reviewed_at",
  ],
  service_order_migration_map: ["orders_id", "account_id", "reviewed_by", "reviewed_at"],
  service_audit_migration_map: [
    "audit_id",
    "actor_account_id",
    "target_account_id",
    "reviewed_by",
    "reviewed_at",
  ],
  access_audit_legacy: ["id", "actor_id", "scope", "action", "target_id", "occurred_at"],
};
// 行の移行だけで完了とせず、旧IDとレビュー対応表を守る書き込み禁止triggerも必須とする。
const archiveTables = [
  "accounts",
  "memberships",
  "actor_qualifications",
  "access_audit_legacy",
  "service_account_migration_map",
  "service_membership_migration_map",
  "service_order_migration_map",
  "service_audit_migration_map",
];

function query(sql: string) {
  const match = /table_info\('([^']+)'\)/.exec(sql);
  if (match) {
    return (columns[match[1]!] ?? []).map((name) => ({ name }));
  }

  if (sql.includes("type='trigger'")) {
    return archiveTables.flatMap((table) =>
      ["insert", "update", "delete"].map((action) => ({ name: `${table}_archive_no_${action}` })),
    );
  }

  return [];
}

describe("サービス別アカウント移行の配備ガード", () => {
  it("完全に空のDBだけは自動マイグレーションへ進める", () =>
    expect(() => assertServiceAccountMigrationReady(() => [])).not.toThrow());
  it("0013資格だけのDBは分類済みでも自動配備を止める", () =>
    expect(() =>
      assertServiceAccountMigrationReady((sql) =>
        sql.includes("sqlite_master") ? [{ name: "actor_qualifications" }] : [],
      ),
    ).toThrow(/0014/));
  it("0014の全テーブルと履歴保護を確認する", () =>
    expect(() => assertServiceAccountMigrationReady(query)).not.toThrow());
  it("一部テーブルだけの移行を拒否する", () =>
    expect(() =>
      assertServiceAccountMigrationReady((sql) =>
        sql.includes("'customer_accounts'") ? [] : query(sql),
      ),
    ).toThrow(/0014/));
  it("旧履歴を変更可能な不完全移行を拒否する", () =>
    expect(() =>
      assertServiceAccountMigrationReady((sql) =>
        sql.includes("type='trigger'") ? [] : query(sql),
      ),
    ).toThrow(/履歴保護/));
  it("外部キー不整合を拒否する", () =>
    expect(() =>
      assertServiceAccountMigrationReady((sql) =>
        sql.includes("foreign_key_check") ? [{ name: "broken" }] : query(sql),
      ),
    ).toThrow(/外部キー/));
});
