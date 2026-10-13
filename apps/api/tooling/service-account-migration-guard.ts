const SERVICE_ACCOUNT_SCHEMA = Object.freeze({
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
});
const ARCHIVED_TABLES = [
  "accounts",
  "memberships",
  "actor_qualifications",
  "access_audit_legacy",
  "service_account_migration_map",
  "service_membership_migration_map",
  "service_order_migration_map",
  "service_audit_migration_map",
];
// 列の存在だけでなく、旧データ・承認済み対応表を変更できない保護も配備条件にする。
const ARCHIVE_MUTATIONS = ["insert", "update", "delete"];
const REQUIRED_ARCHIVE_TRIGGERS = ARCHIVED_TABLES.flatMap((table) =>
  ARCHIVE_MUTATIONS.map((action) => `${table}_archive_no_${action}`),
);

type QueryRow = { name?: string };

/** 空DB以外は0014のテーブル・履歴保護・外部キー整合性を検査してから配備へ進める。 */
export function assertServiceAccountMigrationReady(query: (sql: string) => QueryRow[]) {
  const schema = Object.entries(SERVICE_ACCOUNT_SCHEMA).map((props) => ({
    required: props[1],
    columns: query(`PRAGMA table_info('${props[0]}');`),
  }));
  if (
    schema.every((props) => props.columns.length === 0) &&
    query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('d1_migrations','_cf_KV');",
    ).length === 0
  ) {
    return;
  }

  if (
    schema.some((props) => {
      const names = new Set(props.columns.map((column) => column.name));
      return props.required.some((name) => !names.has(name));
    })
  ) {
    throw new Error(
      "0014のサービス別アカウント移行が未完了です。自動配備を停止しました。全API・Queue・定期実行の書き込みを停止し、バックアップ後にtooling/service-account-migration-map.sqlの対応表でアカウント・所属・注文・監査の帰属を明示的に承認してから0014を適用してください。0013の資格やロール名からの自動分類は禁止です。",
    );
  }

  const triggers = query("SELECT name FROM sqlite_master WHERE type='trigger';");
  if (
    REQUIRED_ARCHIVE_TRIGGERS.some((name) => !triggers.some((trigger) => trigger.name === name))
  ) {
    throw new Error(
      "0014の履歴保護が未完了です。旧アカウントと移行対応表の書き込み禁止トリガーを確認してください。自動配備を停止しました。",
    );
  }

  if (query("PRAGMA foreign_key_check;").length > 0) {
    throw new Error("サービス別アカウントの外部キー不整合があります。自動配備を停止しました。");
  }
}
