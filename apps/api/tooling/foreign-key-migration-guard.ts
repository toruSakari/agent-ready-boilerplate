const LEGACY_FOREIGN_KEY_COLUMNS = Object.freeze({
  memberships: ["user_id", "role_id"],
  role_permissions: ["role_id", "permission"],
  invitations: ["role_id"],
  order_status_assignments: ["order_id", "status_code"],
  product_images: ["product_id"],
});

// 空のDBは初期化できる。0012以前の列があるDBは、共有する全Workerを含めて
// 書き込み停止・移行・配備・再開を揃える必要があるため、自動配備を止める。
export function assertForeignKeyMigrationReady(query: (sql: string) => { name: string }[]) {
  for (const [table, legacyColumns] of Object.entries(LEGACY_FOREIGN_KEY_COLUMNS)) {
    const columns = query(`PRAGMA table_info('${table}');`);
    if (columns.some((column) => legacyColumns.includes(column.name))) {
      throw new Error(
        "0012の外部キー列改名は旧APIと互換性がありません。自動配備を停止しました。docs/cloudflare.mdに従い、このDBを共有する全API・Queue consumer・定期実行を停止し、バックアップ・0012移行・新API配備を手動で完了してから再実行してください。",
      );
    }
  }
}
