// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vite-plus/test";
import { assertActorQualificationMigrationReady } from "@/apps/api/tooling/actor-qualification-migration-guard";

const QUALIFIED_SCHEMA = {
  accounts: ["id", "deleted"],
  organizations: ["id", "active"],
  memberships: ["id", "scope", "accounts_id", "access_roles_id"],
  invitations: ["id", "actor_kind", "inviter_channel"],
  actor_qualifications: ["id", "memberships_id", "actor_kind", "active"],
} as const;
const API_DIRECTORY = fileURLToPath(new URL("../apps/api", import.meta.url));
const COMMAND_TIMEOUT_MS = 10_000;

type QueryRow = { name?: string; count?: number };

function migrationQuery(
  schema: Record<string, readonly string[]> = QUALIFIED_SCHEMA,
  counts: QueryRow[] = [{ count: 0 }],
  existingTables: string[] = [],
) {
  return vi.fn((sql: string): QueryRow[] => {
    const table = /^PRAGMA table_info\('([a-z_]+)'\);$/.exec(sql)?.[1];
    if (table) {
      return (schema[table] ?? []).map((name) => ({ name }));
    }

    if (sql.startsWith("SELECT name FROM sqlite_master")) {
      return existingTables.map((name) => ({ name }));
    }

    if (sql.includes("FROM memberships AS membership")) {
      return counts;
    }

    throw new Error(`Unexpected migration query: ${sql}`);
  });
}

function runPreflight(schema: Record<string, readonly string[]>, unclassifiedCount = 0) {
  const directory = mkdtempSync(join(tmpdir(), "actor-qualification-preflight-"));
  const callsPath = join(directory, "calls.jsonl");
  try {
    // 子プロセスのCLIだけをfixtureへ向け、remote引数を検査しても実D1へ接続しない。
    writeFileSync(
      join(directory, "corepack"),
      `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
const sql = args[args.indexOf("--command") + 1];
appendFileSync(process.env.ACTOR_TEST_CALLS, JSON.stringify(sql) + "\\n");
const table = /^PRAGMA table_info\\('([a-z_]+)'\\);$/.exec(sql)?.[1];
const schema = JSON.parse(process.env.ACTOR_TEST_SCHEMA);
const results = sql.includes("FROM memberships AS membership")
  ? [{ count: Number(process.env.ACTOR_TEST_UNCLASSIFIED) }]
  : sql.includes("sqlite_master") ? Object.keys(schema).map((name) => ({ name })) : (schema[table] ?? []).map((name) => ({ name }));
process.stdout.write(JSON.stringify([{ success: true, results }]));
`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      process.execPath,
      [join(API_DIRECTORY, "tooling/check-inventory-migration.mjs"), "--local"],
      {
        cwd: API_DIRECTORY,
        encoding: "utf8",
        timeout: COMMAND_TIMEOUT_MS,
        env: {
          ...process.env,
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          ACTOR_TEST_SCHEMA: JSON.stringify(schema),
          ACTOR_TEST_CALLS: callsPath,
          ACTOR_TEST_UNCLASSIFIED: String(unclassifiedCount),
        },
      },
    );
    expect(result.error).toBeUndefined();
    const calls = readFileSync(callsPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as string);
    return { ...result, calls };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it("利用者資格移行の自動配備ガード / アプリのテーブルがない新規DBは初期化できる", () => {
  const query = migrationQuery({});

  expect(() => assertActorQualificationMigrationReady(query)).not.toThrow();
  expect(query.mock.calls.at(-1)?.[0]).toContain("FROM sqlite_master");
  expect(query.mock.calls.at(-1)?.[0]).toContain("'d1_migrations', '_cf_KV'");
  expect(query.mock.calls.some((props) => props[0].includes("COUNT(*)"))).toBe(false);
});

it("利用者資格移行の自動配備ガード / Access導入前の既存DBを新規DBとして扱わない", () => {
  const query = migrationQuery({}, [{ count: 0 }], ["orders"]);

  expect(() => assertActorQualificationMigrationReady(query)).toThrow(/0013.*自動配備を停止/);
});

it("利用者資格移行の自動配備ガード / 0012適用済みで空のDBも資格テーブルがなければ拒否する", () => {
  const query = migrationQuery({
    ...QUALIFIED_SCHEMA,
    invitations: ["id"],
    actor_qualifications: [],
  });

  expect(() => assertActorQualificationMigrationReady(query)).toThrow(/0013.*全API/);
  expect(query.mock.calls.every((props) => props[0].startsWith("PRAGMA table_info("))).toBe(true);
});

it.each([
  ["accounts", "deleted"],
  ["organizations", "active"],
  ["memberships", "accounts_id"],
  ["invitations", "actor_kind"],
  ["invitations", "inviter_channel"],
  ["actor_qualifications", "memberships_id"],
  ["actor_qualifications", "actor_kind"],
  ["actor_qualifications", "active"],
] as const)("利用者資格移行の自動配備ガード / %s.%sがない途中状態を拒否する", (table, column) => {
  const query = migrationQuery({
    ...QUALIFIED_SCHEMA,
    [table]: QUALIFIED_SCHEMA[table].filter((name) => name !== column),
  });

  expect(() => assertActorQualificationMigrationReady(query)).toThrow(/0013/);
  expect(query.mock.calls.some((props) => props[0].includes("COUNT(*)"))).toBe(false);
});

it("利用者資格移行の自動配備ガード / 0013適用と明示的な分類が完了したDBを許可する", () => {
  const query = migrationQuery();

  expect(() => assertActorQualificationMigrationReady(query)).not.toThrow();
  expect(query).toHaveBeenCalledTimes(Object.keys(QUALIFIED_SCHEMA).length + 1);
});

it("利用者資格移行の自動配備ガード / 有効な所属に未分類が1件でもあれば拒否し、自動分類しない", () => {
  const query = migrationQuery(QUALIFIED_SCHEMA, [{ count: 1 }]);

  expect(() => assertActorQualificationMigrationReady(query)).toThrow(
    /未分類.*ロールや権限から推測せず/,
  );
  expect(query.mock.calls.every((props) => /^(PRAGMA|SELECT) /.test(props[0]))).toBe(true);
});

it("利用者資格移行の自動配備ガード / 分類確認は有効なアカウントと企業を対象に、スコープに合う資格を必須とする", () => {
  const query = migrationQuery();
  assertActorQualificationMigrationReady(query);
  const sql = query.mock.calls.at(-1)![0];

  expect(sql).toContain("account.deleted = 0");
  expect(sql).toContain("membership.scope = 'platform' OR organization.active = 1");
  expect(sql).toContain("qualification.memberships_id = membership.id");
  expect(sql).toContain("membership.scope = 'platform' AND qualification.actor_kind = 'operator'");
  expect(sql).toContain(
    "membership.scope <> 'platform' AND qualification.actor_kind IN ('business', 'customer')",
  );
  expect(sql).not.toContain("access_roles");
  expect(sql).not.toContain("role_permissions");
});

it("利用者資格移行の自動配備ガード / 明示的に無効化した資格を未分類とせず、再有効化を要求しない", () => {
  const query = migrationQuery();
  assertActorQualificationMigrationReady(query);

  const sql = query.mock.calls.at(-1)![0];
  expect(sql).not.toContain("qualification.active");
  expect(sql).not.toContain("UPDATE");
});

it.each([
  { counts: [] },
  { counts: [{ count: -1 }] },
  { counts: [{ count: 0.5 }] },
  { counts: [{ count: Number.NaN }] },
  { counts: [{}] },
  { counts: [{ count: 0 }, { count: 0 }] },
])("利用者資格移行の自動配備ガード / 不正な件数応答$countsを成功扱いにしない", (props) => {
  const query = migrationQuery(QUALIFIED_SCHEMA, props.counts);
  expect(() => assertActorQualificationMigrationReady(query)).toThrow(/件数確認結果が不正/);
});

it("利用者資格移行の自動配備ガード / スキーマ読み取り失敗を新規DBとして扱わない", () => {
  const failure = new Error("schema unavailable");
  const query = vi.fn(() => {
    throw failure;
  });

  expect(() => assertActorQualificationMigrationReady(query)).toThrow(failure);
  expect(query).toHaveBeenCalledTimes(1);
});

it("利用者資格移行の自動配備ガード / 件数読み取り失敗を未分類なしとして扱わない", () => {
  const failure = new Error("classification unavailable");
  const schema = migrationQuery();
  const query = vi.fn((sql: string) => {
    if (sql.includes("COUNT(*)")) {
      throw failure;
    }

    return schema(sql);
  });

  expect(() => assertActorQualificationMigrationReady(query)).toThrow(failure);
});

it.each([0, 1])(
  "旧0013 DBに対する現在の移行前確認CLI / 旧資格の未分類件数%dにかかわらず0014未移行なら停止する",
  (unclassified) => {
    const result = runPreflight(QUALIFIED_SCHEMA, unclassified);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/0014.*自動配備を停止/);
    expect(result.stdout).toBe("");
    expect(result.calls[0]).toBe("PRAGMA table_info('memberships');");
    expect(result.calls).not.toContain("PRAGMA table_info('inventory_items');");
  },
);
