type QueryRow = { name?: string; code?: string };

/** プラン認可に必要な列とpermission定義を確認する。会員・企業への割当は変更しない。 */
export function assertPlanMigrationReady(query: (sql: string) => QueryRow[]) {
  const columns = ["organizations", "customer_accounts"].map((table) =>
    query(`PRAGMA table_info('${table}');`),
  );
  if (
    columns.every((items) => items.length === 0) &&
    query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('d1_migrations','_cf_KV');",
    ).length === 0
  ) {
    return;
  }

  if (columns.some((items) => !items.some((column) => column.name === "plan_code"))) {
    throw new Error("0015のプラン参照列が未適用です。schemaのマイグレーションを適用してください。");
  }

  if (
    !query("SELECT code FROM permissions WHERE code='plan.manage';").some(
      (row) => row.code === "plan.manage",
    )
  ) {
    throw new Error("0016のプラン管理permission定義が未適用です。");
  }
}
