// @vitest-environment node
import { drizzle } from "drizzle-orm/d1";
import { seedDevelopment } from "@/apps/api/tooling/seeds/seed-development.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import {
  customerAccounts,
  businessAccounts,
  operatorAccounts,
  customerMemberships,
  businessMemberships,
  operatorMemberships,
} from "#api/infrastructure/access/schemas/schema.ts";

const API = fileURLToPath(new URL("../apps/api", import.meta.url));
const NOW = "2026-10-04T00:00:00.000Z";
const TIMEOUT_MS = 30_000;

type Bindings = { UPGRADED_DB: D1Database; FRESH_DB: D1Database };

let platform: Awaited<ReturnType<typeof getPlatformProxy<Bindings>>>;
let migration: string;
const laterMigrations: string[] = [];

function statements(source: string, atomic: boolean) {
  return source
    .split(atomic ? "--> statement-breakpoint" : ";")
    .map((sql) => sql.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
}

async function apply(db: D1Database, source: string, atomic = false) {
  await db.batch(statements(source, atomic).map((sql) => db.prepare(sql)));
}

async function all(db: D1Database, sql: string) {
  return (await db.prepare(sql).all()).results;
}

beforeAll(async () => {
  platform = await getPlatformProxy<Bindings>({
    configPath: fileURLToPath(new URL("./wrangler.foreign-keys-test.jsonc", import.meta.url)),
    persist: false,
  });
  for (const file of readdirSync(join(API, "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const source = readFileSync(join(API, "drizzle", file), "utf8");
    if (file.startsWith("0014_")) {
      migration = source;
      continue;
    }

    if (Number(file.slice(0, 4)) > 14) {
      laterMigrations.push(source);
      continue;
    }

    await apply(platform.env.UPGRADED_DB, source);
    await apply(platform.env.FRESH_DB, source);
  }

  const db = platform.env.UPGRADED_DB;
  await apply(
    db,
    `
    INSERT INTO organizations VALUES ('old-company','既存企業',1,1);
    INSERT INTO accounts VALUES ('old-shared','共有旧利用者','old@example.test',0),('old-deleted','削除履歴',NULL,1);
    INSERT INTO access_roles VALUES ('old-owner','old-company','オーナー',1),('old-platform','platform','管理者',1),('old-customer','old-company','明示指定顧客ロール',0);
    INSERT INTO role_permissions VALUES ('old-customer-read','old-customer','order:read');
    INSERT INTO memberships VALUES ('old-member','old-company','old-shared','old-owner'),('old-operator','platform','old-shared','old-platform'),('old-disabled','old-company','old-deleted','old-owner');
    INSERT INTO actor_qualifications VALUES ('old-q','old-member','business',1);
    INSERT INTO orders (id,tenant_id,customer_id,lines,total,created_at) VALUES ('old-customer-order','old-company','old-shared','[]',0,'${NOW}'),('old-business-order','old-company','old-shared','[]',0,'${NOW}'),('old-deleted-order','old-company','old-deleted','[]',0,'${NOW}');
    INSERT INTO access_audit VALUES ('old-audit','old-shared','old-company','member.remove','old-shared','${NOW}');
    INSERT INTO invitations VALUES ('old-invite','old-company','old@example.test','old-owner','old-token','2099-01-01T00:00:00.000Z','old-shared','business','business');
    INSERT INTO outbox_events (id,aggregate_id,event_type,payload,occurred_at) VALUES ('old-event','old-customer-order','OrderCreated','{"customerId":"old-shared"}','${NOW}');
  `,
  );
}, TIMEOUT_MS);
afterAll(async () => {
  await platform?.dispose();
});
// 失敗時の巻き戻し→レビュー修正→成功→履歴保護を同じDBで追うため、実行順を固定する。
describe.sequential("0014独立サービスアカウント移行", () => {
  it("0013分類済みでもレビュー済み対応表なしでは原子的に停止する", rejectUnreviewedMigration);
  it(
    "明示対応表も誤った注文帰属なら停止し、正しいレビューだけを移行する",
    reviewAndMigrateAccounts,
    TIMEOUT_MS,
  );
  it("旧ID・対応表・監査原文を読み取り専用履歴として保持する", assertLegacyHistory);
  it("新規DBは空のまま移行でき明示的ローカルseedも通る", migrateFreshDatabase);
  it("Drizzleの列・外部キー名・一意性が実DBと一致する", assertServiceSchema);
});

async function rejectUnreviewedMigration() {
  const db = platform.env.UPGRADED_DB;
  await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
  expect(await all(db, "SELECT name FROM sqlite_master WHERE name='customer_accounts'")).toEqual(
    [],
  );
  expect(await all(db, "SELECT customer_id FROM orders WHERE id='old-customer-order'")).toEqual([
    { customer_id: "old-shared" },
  ]);
  expect(await all(db, "SELECT * FROM actor_qualifications")).toHaveLength(1);
}

async function reviewAndMigrateAccounts() {
  const db = platform.env.UPGRADED_DB;
  await prepareReviewedMappings(db);
  await rejectUnsafeMembershipRoles(db);
  await rejectOperatorOrderOwnership(db);
  await rejectMalformedServiceIdentifiers(db);
  await rejectMalformedRoleIdentifiers(db);
  await applyAndAssertReviewedMigration(db);
}

async function assertLegacyHistory() {
  const db = platform.env.UPGRADED_DB;
  expect(await all(db, "SELECT id FROM accounts ORDER BY id")).toEqual([
    { id: "old-deleted" },
    { id: "old-shared" },
  ]);
  for (const table of [
    "accounts",
    "memberships",
    "actor_qualifications",
    "access_audit_legacy",
    "service_account_migration_map",
    "service_membership_migration_map",
    "service_order_migration_map",
    "service_audit_migration_map",
  ]) {
    await expect(db.prepare(`DELETE FROM ${table}`).run()).rejects.toThrow(/read-only/);
  }
}

async function migrateFreshDatabase() {
  const db = platform.env.FRESH_DB;
  await apply(db, migration, true);
  for (const source of laterMigrations) {
    await apply(db, source, true);
  }

  await seedDevelopment(drizzle(db));
  expect(await all(db, "SELECT id FROM operator_accounts")).toEqual([{ id: "operator:demo-user" }]);
  expect(await all(db, "SELECT id FROM customer_accounts")).toHaveLength(2);
  expect(await all(db, "SELECT id FROM business_accounts")).toHaveLength(2);
}

async function assertServiceSchema() {
  const db = platform.env.FRESH_DB;
  await assertServiceForeignKeySchema(db);
  await rejectInvalidMembershipLinks(db);
  await rejectInvalidAccountIdentifiers(db);
  await assertIdentityImmutability(db);
}

async function prepareReviewedMappings(db: D1Database) {
  await apply(
    db,
    readFileSync(join(API, "tooling/service-account-migration-map.sql"), "utf8"),
    true,
  );
  await apply(
    db,
    `
      INSERT INTO service_account_migration_map VALUES ('map-c','old-shared','customer','customer:old','clerk-shared','reviewer','${NOW}'),('map-b','old-shared','business','business:old','clerk-shared','reviewer','${NOW}'),('map-o','old-shared','operator','operator:old','clerk-shared','reviewer','${NOW}'),('map-d','old-deleted','customer','customer:deleted','clerk-deleted','reviewer','${NOW}');
      INSERT INTO service_membership_migration_map VALUES ('member-b','old-member','business:old','business:old-member','old-owner',1,'reviewer','${NOW}'),('member-c','old-member','customer:old','customer:old-member','old-owner',1,'reviewer','${NOW}'),('member-o','old-operator','operator:old','operator:old-member','old-platform',1,'reviewer','${NOW}'),('member-d','old-disabled','customer:deleted','customer:disabled-member','old-customer',0,'reviewer','${NOW}');
      INSERT INTO service_order_migration_map VALUES ('old-customer-order','customer:old','reviewer','${NOW}'),('old-business-order','business:old','reviewer','${NOW}'),('old-deleted-order','customer:deleted','reviewer','${NOW}');
      INSERT INTO service_audit_migration_map VALUES ('old-audit','business:old','business:old','reviewer','${NOW}');
    `,
  );
}

async function rejectUnsafeMembershipRoles(db: D1Database) {
  // 対応先を明示しても、通常会員へ企業オーナーの保護ロールを引き継ぐことは許可しない。
  await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
  await db
    .prepare(
      "UPDATE service_membership_migration_map SET access_roles_id='old-customer' WHERE id='member-c'",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO role_permissions VALUES ('unsafe-customer','old-customer','member.invite')",
    )
    .run();
  await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
  await db.prepare("DELETE FROM role_permissions WHERE id='unsafe-customer'").run();
  await db
    .prepare(
      "UPDATE service_membership_migration_map SET access_roles_id='old-platform' WHERE id='member-b'",
    )
    .run();
  await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
  await db
    .prepare(
      "UPDATE service_membership_migration_map SET access_roles_id='old-owner' WHERE id='member-b'",
    )
    .run();
}

async function rejectOperatorOrderOwnership(db: D1Database) {
  // ロールが安全でも、運営会員を過去の注文所有者にする対応表は拒否する。
  await db
    .prepare(
      "UPDATE service_order_migration_map SET account_id='operator:old' WHERE orders_id='old-customer-order'",
    )
    .run();
  await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
  await db
    .prepare(
      "UPDATE service_order_migration_map SET account_id='customer:old' WHERE orders_id='old-customer-order'",
    )
    .run();
}

async function rejectMalformedServiceIdentifiers(db: D1Database) {
  for (const invalidId of [
    "business:",
    "business: ",
    " business:bad",
    "business:bad ",
    "business:bad\t",
    "business:bad\u00a0",
    "business:bad\n",
    "business:bad\u3000",
    `business:${"x".repeat(201)}`,
  ]) {
    await db
      .prepare(
        "INSERT INTO service_account_migration_map VALUES ('invalid-id-map','old-deleted','business',?,'clerk-deleted','reviewer',?)",
      )
      .bind(invalidId, NOW)
      .run();
    await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
    await db.prepare("DELETE FROM service_account_migration_map WHERE id='invalid-id-map'").run();
    await db
      .prepare("UPDATE service_membership_migration_map SET membership_id=? WHERE id='member-b'")
      .bind(invalidId)
      .run();
    await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
    await db
      .prepare(
        "UPDATE service_membership_migration_map SET membership_id='business:old-member' WHERE id='member-b'",
      )
      .run();
  }
}

async function rejectMalformedRoleIdentifiers(db: D1Database) {
  for (const invalidRoleId of [
    " old-role",
    "old-role ",
    "old-role\t",
    "old-role\u3000",
    "x".repeat(201),
  ]) {
    await db
      .prepare("INSERT INTO access_roles VALUES (?,'old-company','不正IDの明示対象',0)")
      .bind(invalidRoleId)
      .run();
    await db
      .prepare("UPDATE service_membership_migration_map SET access_roles_id=? WHERE id='member-b'")
      .bind(invalidRoleId)
      .run();
    await expect(apply(db, migration, true)).rejects.toThrow(/CHECK constraint failed/);
    await db
      .prepare(
        "UPDATE service_membership_migration_map SET access_roles_id='old-owner' WHERE id='member-b'",
      )
      .run();
    await db.prepare("DELETE FROM access_roles WHERE id=?").bind(invalidRoleId).run();
  }
}

async function applyAndAssertReviewedMigration(db: D1Database) {
  await apply(db, migration, true);
  // 0014の明示対応を検証してから後続移行へ進み、0019では旧所属だけが解消されることを確認する。
  expect(
    await all(db, "SELECT id,customer_accounts_id,access_roles_id FROM customer_memberships"),
  ).toEqual([
    {
      id: "customer:old-member",
      customer_accounts_id: "customer:old",
      access_roles_id: "old-customer",
    },
  ]);
  for (const source of laterMigrations) {
    await apply(db, source, true);
  }

  expect(await all(db, "SELECT id,customer_id FROM orders ORDER BY id")).toEqual([
    { id: "old-business-order", customer_id: "business:old" },
    { id: "old-customer-order", customer_id: "customer:old" },
    { id: "old-deleted-order", customer_id: "customer:deleted" },
  ]);
  expect(await all(db, "SELECT id FROM customer_memberships")).toEqual([]);
  expect(await all(db, "SELECT access_roles_id FROM business_memberships")).toEqual([
    { access_roles_id: "old-owner" },
  ]);
  expect(await all(db, "SELECT id,subject_id,deleted FROM customer_accounts ORDER BY id")).toEqual([
    { id: "customer:deleted", subject_id: "clerk-deleted", deleted: 1 },
    { id: "customer:old", subject_id: "clerk-shared", deleted: 0 },
  ]);
  expect(await all(db, "SELECT actor_id,target_id FROM access_audit")).toEqual([
    { actor_id: "business:old", target_id: "business:old" },
  ]);
  expect(await all(db, "SELECT actor_id,target_id FROM access_audit_legacy")).toEqual([
    { actor_id: "old-shared", target_id: "old-shared" },
  ]);
  expect(await all(db, "SELECT payload FROM outbox_events")).toEqual([
    { payload: '{"customerId":"old-shared"}' },
  ]);
  expect(await all(db, "SELECT actor_kind,inviter_channel FROM invitations")).toEqual([
    { actor_kind: null, inviter_channel: null },
  ]);
  expect(await all(db, "PRAGMA foreign_key_check")).toEqual([]);
}

async function assertServiceForeignKeySchema(db: D1Database) {
  for (const table of [
    customerAccounts,
    businessAccounts,
    operatorAccounts,
    customerMemberships,
    businessMemberships,
    operatorMemberships,
  ]) {
    const config = getTableConfig(table);
    expect((await all(db, `PRAGMA table_info(${config.name})`)).map((props) => props.name)).toEqual(
      config.columns.map((column) => column.name),
    );
    for (const edge of await all(db, `PRAGMA foreign_key_list(${config.name})`)) {
      expect(edge.from).toBe(`${String(edge.table)}_id`);
    }
  }
}

async function rejectInvalidMembershipLinks(db: D1Database) {
  await expect(
    db
      .prepare(
        "INSERT INTO customer_accounts (id,subject_id,name,email,deleted) VALUES ('customer:duplicate','demo-user','duplicate',NULL,0)",
      )
      .run(),
  ).rejects.toThrow(/UNIQUE/);
  await expect(
    db
      .prepare(
        "INSERT INTO customer_accounts (id,subject_id,name,email,deleted) VALUES ('business:bad','new','bad',NULL,0)",
      )
      .run(),
  ).rejects.toThrow(/CHECK/);
  await expect(
    db
      .prepare(
        "INSERT INTO customer_memberships VALUES ('business:wrong','demo-store','customer:demo-user','demo-store:staff')",
      )
      .run(),
  ).rejects.toThrow(/CHECK/);
  await expect(
    db
      .prepare(
        "INSERT INTO business_memberships VALUES ('business:wrong-scope','demo-store','business:demo-user','demo-second:owner')",
      )
      .run(),
  ).rejects.toThrow(/scope mismatch/);
}

async function rejectInvalidAccountIdentifiers(db: D1Database) {
  for (const invalidId of [
    "customer:",
    "customer: ",
    " customer:bad",
    "customer:bad ",
    "customer:bad\t",
    "customer:bad\u00a0",
    "customer:bad\n",
    "customer:bad\u3000",
    `customer:${"x".repeat(201)}`,
  ]) {
    await expect(
      db
        .prepare(
          "INSERT INTO customer_accounts (id,subject_id,name,email,deleted) VALUES (?,'new-subject','bad',NULL,0)",
        )
        .bind(invalidId)
        .run(),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db
        .prepare(
          "INSERT INTO customer_memberships VALUES (?,'demo-store','customer:demo-user','demo-store:staff')",
        )
        .bind(invalidId)
        .run(),
    ).rejects.toThrow(/CHECK/);
  }
}

async function assertIdentityImmutability(db: D1Database) {
  await expect(
    db.prepare("UPDATE access_roles SET scope='demo-second' WHERE id='demo-store:owner'").run(),
  ).rejects.toThrow(/immutable/);
  await expect(
    db
      .prepare("UPDATE customer_accounts SET subject_id='another' WHERE id='customer:demo-user'")
      .run(),
  ).rejects.toThrow(/immutable/);
  await expect(
    platform.env.UPGRADED_DB.prepare(
      "UPDATE customer_accounts SET deleted=0 WHERE id='customer:deleted'",
    ).run(),
  ).rejects.toThrow(/immutable/);
  expect(await all(db, "PRAGMA foreign_key_check")).toEqual([]);
}
