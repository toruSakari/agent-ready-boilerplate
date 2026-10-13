// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vite-plus/test";
import { assertForeignKeyMigrationReady } from "@/apps/api/tooling/foreign-key-migration-guard";

const RENAMED_SCHEMA = {
  memberships: ["id", "scope", "accounts_id", "access_roles_id"],
  role_permissions: ["id", "access_roles_id", "permissions_id"],
  invitations: [
    "id",
    "scope",
    "email",
    "access_roles_id",
    "token_hash",
    "expires_at",
    "inviter_id",
  ],
  order_status_assignments: ["orders_id", "order_statuses_id", "updated_at"],
  product_images: ["id", "tenant_id", "products_id", "image_key", "state"],
} as const;
const LEGACY_COLUMNS = [
  ["memberships", "user_id", "accounts_id"],
  ["memberships", "role_id", "access_roles_id"],
  ["role_permissions", "role_id", "access_roles_id"],
  ["role_permissions", "permission", "permissions_id"],
  ["invitations", "role_id", "access_roles_id"],
  ["order_status_assignments", "order_id", "orders_id"],
  ["order_status_assignments", "status_code", "order_statuses_id"],
  ["product_images", "product_id", "products_id"],
] as const;
const API_DIRECTORY = fileURLToPath(new URL("../apps/api", import.meta.url));
const COMMAND_TIMEOUT_MS = 10_000;

function schemaQuery(schema: Record<string, readonly string[]>) {
  return vi.fn((sql: string) => {
    const match = /^PRAGMA table_info\('([a-z_]+)'\);$/.exec(sql);
    if (!match) {
      throw new Error(`Unexpected schema query: ${sql}`);
    }

    return (schema[match[1]!] ?? []).map((name) => ({ name }));
  });
}

function runPreflight(
  schema: Record<string, readonly string[]>,
  args: string[] = [],
  failQuery = false,
) {
  const directory = mkdtempSync(join(tmpdir(), "foreign-key-preflight-"));
  const callsPath = join(directory, "calls.jsonl");
  try {
    // この子プロセスだけWranglerの起動口を差し替え、実DBへ接続せず引数と停止順序を確認する。
    writeWranglerStub(directory);
    const result = spawnSync(
      process.execPath,
      [join(API_DIRECTORY, "tooling/check-inventory-migration.mjs"), ...args],
      {
        cwd: API_DIRECTORY,
        encoding: "utf8",
        timeout: COMMAND_TIMEOUT_MS,
        env: {
          ...process.env,
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          FK_TEST_SCHEMA: JSON.stringify(schema),
          FK_TEST_CALLS: callsPath,
          FK_TEST_FAIL_QUERY: failQuery ? "1" : "0",
        },
      },
    );
    assertCommandStarted(result.error);
    const calls = readFileSync(callsPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as string[]);
    return { ...result, calls };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it.each(LEGACY_COLUMNS)(
  "外部キー列移行の自動配備ガード / %s.%sが残るDBは、行数を問い合わせずに拒否する",
  (table, legacyColumn, renamedColumn) => {
    const query = schemaQuery({
      ...RENAMED_SCHEMA,
      [table]: [...RENAMED_SCHEMA[table].filter((name) => name !== renamedColumn), legacyColumn],
    });

    expect(() => assertForeignKeyMigrationReady(query)).toThrow(/0012.*旧API.*自動配備を停止/);
    expect(query).toHaveBeenCalledWith(`PRAGMA table_info('${table}');`);
    expect(query.mock.calls.every((props) => props[0].startsWith("PRAGMA table_info("))).toBe(true);
  },
);

it("外部キー列移行の自動配備ガード / 新旧の列が共存する途中状態でも自動配備を拒否する", () => {
  const query = schemaQuery({
    ...RENAMED_SCHEMA,
    product_images: [...RENAMED_SCHEMA.product_images, "product_id"],
  });

  expect(() => assertForeignKeyMigrationReady(query)).toThrow(/0012/);
  expect(query).toHaveBeenCalledTimes(Object.keys(RENAMED_SCHEMA).length);
});

it("外部キー列移行の自動配備ガード / テーブルのない新規DBを初期化できる", () => {
  const query = schemaQuery({});

  expect(() => assertForeignKeyMigrationReady(query)).not.toThrow();
  expect(query.mock.calls.map((props) => props[0])).toEqual(
    Object.keys(RENAMED_SCHEMA).map((table) => `PRAGMA table_info('${table}');`),
  );
});

it("外部キー列移行の自動配備ガード / 8列すべて改名済みなら自動配備を許可する", () => {
  const query = schemaQuery(RENAMED_SCHEMA);

  expect(() => assertForeignKeyMigrationReady(query)).not.toThrow();
  expect(query).toHaveBeenCalledTimes(Object.keys(RENAMED_SCHEMA).length);
});

it("外部キー列移行の自動配備ガード / 外部キーではないorder_id等を改名対象として扱わない", () => {
  const query = schemaQuery({
    ...RENAMED_SCHEMA,
    inventory_allocations: ["id", "tenant_id", "order_id", "sku"],
    order_event_history: ["event_id", "tenant_id", "order_id"],
    payments: ["id", "tenant_id", "order_id"],
    orders: ["id", "tenant_id", "customer_id", "reservation_id", "last_event_id"],
    access_audit: ["id", "actor_id", "target_id"],
  });

  expect(() => assertForeignKeyMigrationReady(query)).not.toThrow();
  expect(query.mock.calls.map((props) => props[0])).toEqual(
    Object.keys(RENAMED_SCHEMA).map((table) => `PRAGMA table_info('${table}');`),
  );
});

it.each(Object.keys(RENAMED_SCHEMA))(
  "外部キー列移行の自動配備ガード / %sの読み取り失敗を新規DBとして扱わず、そのまま伝える",
  (failedTable) => {
    const failure = new Error(`Schema query failed: ${failedTable}`);
    const readSchema = schemaQuery(RENAMED_SCHEMA);
    const query = vi.fn((sql: string) => {
      if (sql === `PRAGMA table_info('${failedTable}');`) {
        throw failure;
      }

      return readSchema(sql);
    });

    expect(() => assertForeignKeyMigrationReady(query)).toThrow(failure);
    expect(query.mock.calls.at(-1)).toEqual([`PRAGMA table_info('${failedTable}');`]);
  },
);

it("移行前確認CLI / 新規DBは指定されたPreview設定とlocal指定で確認する", () => {
  const config = "/generated/preview-api.jsonc";
  const result = runPreflight({}, ["--config", config, "--local"]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("事前確認が完了");
  expect(result.stderr).toBe("");
  for (const call of result.calls) {
    expect(call.slice(0, 10)).toEqual([
      "pnpm",
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      config,
      "--command",
    ]);
    expect(call.at(-1)).toBe("--json");
  }
});

it("移行前確認CLI / 0012改名済みDBも0014未移行なら既定のremote設定で停止する", () => {
  const result = runPreflight({
    ...RENAMED_SCHEMA,
    accounts: ["id", "deleted"],
    organizations: ["id", "active"],
    invitations: [...RENAMED_SCHEMA.invitations, "actor_kind", "inviter_channel"],
    actor_qualifications: ["id", "memberships_id", "actor_kind", "active"],
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/0014.*自動配備を停止/);
  for (const call of result.calls) {
    expect(call.slice(6, 9)).toEqual(["--remote", "--config", "wrangler.jsonc"]);
  }
});

it("移行前確認CLI / 空でも旧列を持つDBは在庫や行数の検査前に終了コード1で停止する", () => {
  const result = runPreflight({ ...RENAMED_SCHEMA, product_images: ["id", "product_id"] });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/0012.*自動配備を停止/);
  expect(result.stdout).toBe("");
  expect(result.calls).toHaveLength(Object.keys(RENAMED_SCHEMA).length);
  expect(
    result.calls.every((call) =>
      call[call.indexOf("--command") + 1]!.startsWith("PRAGMA table_info("),
    ),
  ).toBe(true);
});

it("移行前確認CLI / Wrangler確認に失敗した場合も成功扱いにしない", () => {
  const result = runPreflight(RENAMED_SCHEMA, [], true);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("DB接続とWrangler設定を確認");
  expect(result.stdout).toBe("");
  expect(result.calls).toHaveLength(1);
});

function assertCommandStarted(error: Error | undefined) {
  expect(error).toBeUndefined();
}

function writeWranglerStub(directory: string) {
  writeFileSync(
    join(directory, "corepack"),
    `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.FK_TEST_CALLS, JSON.stringify(args) + "\\n");
if (process.env.FK_TEST_FAIL_QUERY === "1") process.exit(1);
const sql = args[args.indexOf("--command") + 1];
const table = /^PRAGMA table_info\\('([a-z_]+)'\\);$/.exec(sql)?.[1];
const schema = JSON.parse(process.env.FK_TEST_SCHEMA);
const results = sql.includes("FROM memberships AS membership")
  ? [{ count: 0 }]
  : sql.includes("sqlite_master") ? Object.keys(schema).map((name) => ({ name })) : (schema[table] ?? []).map((name) => ({ name }));
process.stdout.write(JSON.stringify([{ success: true, results }]));
`,
    { mode: 0o755 },
  );
}
