import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { assertServiceAccountMigrationReady } from "#api-tooling/service-account-migration-guard.ts";
import { assertForeignKeyMigrationReady } from "#api-tooling/foreign-key-migration-guard.ts";
import { assertPlanMigrationReady } from "#api-tooling/plan-migration-guard.ts";

const { values } = parseArgs({
  options: {
    local: { type: "boolean", default: false },
    config: { type: "string", default: "wrangler.jsonc" },
  },
});

// 読み取りだけの事前検査。既定はremoteなので、ローカル確認には明示的に--localを指定する。
function query(sql) {
  const result = spawnSync(
    "corepack",
    [
      "pnpm",
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      values.local ? "--local" : "--remote",
      "--config",
      values.config,
      "--command",
      sql,
      "--json",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error("在庫移行の事前確認に失敗しました。DB接続とWrangler設定を確認してください。");
  }

  const output = JSON.parse(result.stdout);
  if (!Array.isArray(output) || output.some((entry) => !entry.success)) {
    throw new Error("DBの事前確認結果が不正です。");
  }

  return output.flatMap((entry) => entry.results);
}

try {
  assertForeignKeyMigrationReady(query);
  assertServiceAccountMigrationReady(query);
  assertPlanMigrationReady(query);
  assertTenantInventoryReady();
  console.log("在庫・外部キー列・サービス別アカウント移行の事前確認が完了しました。");
} catch (error) {
  console.error(error instanceof Error ? error.message : "在庫移行の事前確認に失敗しました。");
  process.exitCode = 1;
}

function assertTenantInventoryReady() {
  const tables = query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('inventory_items','inventory_allocations','orders');",
  ).map((row) => row.name);
  // 旧SKU単独の在庫へ実データがある場合は、企業への帰属を推測して自動移行しない。
  if (!tables.includes("inventory_items")) {
    return;
  }

  const columns = query("PRAGMA table_info('inventory_items');");
  const companyKey = columns.some((column) => column.name === "tenant_id" && column.pk > 0);
  if (companyKey) {
    return;
  }

  const sql = tables.map((table) => `SELECT COUNT(*) AS count FROM ${table}`).join(" UNION ALL ");
  const existingData = query(sql).some((row) => row.count > 0);
  if (existingData) {
    throw new Error(
      "旧形式の在庫・注文データがあります。自動配備を停止しました。docs/cloudflare.mdに従い、書き込み停止・Queue処理完了・バックアップ・企業別データ移行を手動で完了してから再実行してください。",
    );
  }
}
