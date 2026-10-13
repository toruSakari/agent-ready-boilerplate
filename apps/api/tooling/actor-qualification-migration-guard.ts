// 移行0013の回帰検証専用に残す検査。
// 現在の配備前検査はservice-account-migration-guard.ts（0014）を使う。
const QUALIFIED_ACCESS_SCHEMA = Object.freeze({
  accounts: ["id", "deleted"],
  organizations: ["id", "active"],
  memberships: ["id", "scope", "accounts_id"],
  invitations: ["id", "actor_kind", "inviter_channel"],
  actor_qualifications: ["id", "memberships_id", "actor_kind", "active"],
});

const UNCLASSIFIED_MEMBERSHIPS_QUERY = `SELECT COUNT(*) AS count
FROM memberships AS membership
JOIN accounts AS account ON account.id = membership.accounts_id
LEFT JOIN organizations AS organization ON organization.id = membership.scope
WHERE account.deleted = 0
  AND (membership.scope = 'platform' OR organization.active = 1)
  AND NOT EXISTS (
    SELECT 1 FROM actor_qualifications AS qualification
    WHERE qualification.memberships_id = membership.id
      AND (
        (membership.scope = 'platform' AND qualification.actor_kind = 'operator')
        OR (membership.scope <> 'platform' AND qualification.actor_kind IN ('business', 'customer'))
      )
  );`;

const EXISTING_APPLICATION_TABLES_QUERY =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('d1_migrations', '_cf_KV');";

type MigrationQueryRow = { name?: string; count?: number };

// 資格は人が明示的に分類し、この検査では割り当てない。
// 無効な分類も確認済みと数えるが、実行時の利用資格は与えない。
export function assertActorQualificationMigrationReady(
  query: (sql: string) => MigrationQueryRow[],
) {
  const schema = Object.entries(QUALIFIED_ACCESS_SCHEMA).map((props) => ({
    requiredColumns: props[1],
    columns: query(`PRAGMA table_info('${props[0]}');`),
  }));
  if (schema.every((props) => props.columns.length === 0)) {
    if (query(EXISTING_APPLICATION_TABLES_QUERY).length === 0) {
      return;
    }
  }

  if (
    schema.some((props) => {
      const names = new Set(props.columns.map((column) => column.name));
      return props.requiredColumns.some((name) => !names.has(name));
    })
  ) {
    throw new Error(
      "0013の利用者資格移行が未完了です。自動配備を停止しました。docs/cloudflare.mdに従い、このDBを共有する全API・Queue consumer・定期実行と書き込みを停止し、バックアップ・0013移行・所属の明示的な資格分類・旧招待の再発行準備を承認された手順で完了してください。",
    );
  }

  const counts = query(UNCLASSIFIED_MEMBERSHIPS_QUERY);
  const count = counts[0]?.count;
  if (
    counts.length !== 1 ||
    typeof count !== "number" ||
    !Number.isSafeInteger(count) ||
    count < 0
  ) {
    throw new Error("利用者資格移行の件数確認結果が不正です。自動配備を停止しました。");
  }

  if (count > 0) {
    throw new Error(
      "0013適用後の有効な所属に利用者資格の未分類があります。自動配備を停止しました。ロールや権限から推測せず、docs/cloudflare.mdに従い、確認済みの所属対応表で運営・事業者・顧客を明示的に分類してください。無効化済みの資格を再有効化する必要はありません。",
    );
  }
}
