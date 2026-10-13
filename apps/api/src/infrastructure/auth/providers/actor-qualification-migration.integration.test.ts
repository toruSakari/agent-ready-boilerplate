// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  legacyActorQualifications as actorQualifications,
  invitations,
} from "#api/infrastructure/access/schemas/schema.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
// 現行の0014より前で止め、0013当時のデータ保持・未分類のままの拒否条件を回帰検証する。
const ACTOR_MIGRATION_PREFIX = "0013_";
const INTEGRATION_STARTUP_TIMEOUT_MS = 30_000;
const LEGACY_INVITATION_TOKEN = "d".repeat(64);

type Row = Record<string, string | number | null>;

type Column = { name: string; type: string; notnull: number; pk: number };

let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let legacyMemberships: Row[];
let legacyInvitations: Row[];
let migratedMemberships: Row[];
let migratedInvitations: Row[];
let initialQualifications: Row[];

async function rows<T>(statement: string) {
  return (await platform.env.DB.prepare(statement).all<T>()).results;
}

async function migration(file: string) {
  const statements = readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8")
    .split(";")
    .map((statement) => statement.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
  await platform.env.DB.batch(statements.map((statement) => platform.env.DB.prepare(statement)));
}

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(
      new URL("../../access/repositories/wrangler.access-test.jsonc", import.meta.url),
    ),
    persist: false,
  });
  const migrations = readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const actorMigration = migrations.find((file) => file.startsWith(ACTOR_MIGRATION_PREFIX));
  if (!actorMigration) {
    throw new Error("利用主体資格のマイグレーションがありません");
  }

  for (const file of migrations.filter((file) => file < actorMigration)) {
    await migration(file);
  }

  await platform.env.DB.batch([
    platform.env.DB.prepare(
      "INSERT INTO organizations (id,name,active,invitations_enabled) VALUES ('legacy-tenant','既存企業',1,1)",
    ),
    platform.env.DB.prepare(
      "INSERT INTO accounts (id,name,email,deleted) VALUES ('legacy-account','既存アカウント','legacy@example.com',0)",
    ),
    platform.env.DB.prepare(
      "INSERT INTO access_roles (id,scope,name,protected_role) VALUES ('legacy-platform-role','platform','既存運営管理者',1),('legacy-tenant-role','legacy-tenant','既存企業管理者',1)",
    ),
    platform.env.DB.prepare(
      "INSERT INTO role_permissions (id,access_roles_id,permissions_id) VALUES ('legacy-platform-permission','legacy-platform-role','member.invite'),('legacy-tenant-permission','legacy-tenant-role','order:read')",
    ),
    platform.env.DB.prepare(
      "INSERT INTO memberships (id,scope,accounts_id,access_roles_id) VALUES ('legacy-platform-member','platform','legacy-account','legacy-platform-role'),('legacy-tenant-member','legacy-tenant','legacy-account','legacy-tenant-role')",
    ),
    platform.env.DB.prepare(
      "INSERT INTO invitations (id,scope,email,access_roles_id,token_hash,expires_at,inviter_id) VALUES ('legacy-invitation','legacy-tenant','legacy-invite@example.com','legacy-tenant-role',?,'2099-01-01T00:00:00.000Z','legacy-account')",
    ).bind(LEGACY_INVITATION_TOKEN),
  ]);
  legacyMemberships = await rows<Row>("SELECT * FROM memberships ORDER BY id");
  legacyInvitations = await rows<Row>("SELECT * FROM invitations ORDER BY id");
  await migration(actorMigration);
  migratedMemberships = await rows<Row>("SELECT * FROM memberships ORDER BY id");
  migratedInvitations = await rows<Row>("SELECT * FROM invitations ORDER BY id");
  initialQualifications = await rows<Row>("SELECT * FROM actor_qualifications");
}, INTEGRATION_STARTUP_TIMEOUT_MS);
afterAll(async () => {
  await platform?.dispose();
});

it("利用主体資格の既存DB移行 / 既存所属とロールを保持しても資格を自動で付与しない", async () => {
  expect(migratedMemberships).toEqual(legacyMemberships);
  expect(initialQualifications).toEqual([]);
});

it("利用主体資格の既存DB移行 / 未消費の旧招待は新項目をnullに保つ", async () => {
  expect(migratedInvitations).toEqual(
    legacyInvitations.map((invitation) => ({
      ...invitation,
      actor_kind: null,
      inviter_channel: null,
    })),
  );
  expect(await rows<Row>("SELECT * FROM memberships ORDER BY id")).toEqual(legacyMemberships);
  expect(await rows<Row>("SELECT * FROM actor_qualifications")).toEqual([]);
});

it("利用主体資格の既存DB移行 / Drizzleの新項目と実DBの列・FK・一意インデックスが一致する", async () => {
  for (const table of [actorQualifications, invitations]) {
    const config = getTableConfig(table);
    expect(
      (await rows<Column>(`PRAGMA table_info(${config.name})`)).map((props) => ({
        name: props.name,
        type: props.type.toLowerCase(),
        notnull: props.notnull,
        pk: props.pk,
      })),
    ).toEqual(
      config.columns.map((column) => ({
        name: column.name,
        type: column.getSQLType().toLowerCase(),
        notnull: Number(column.notNull),
        pk: Number(column.primary),
      })),
    );
  }

  expect(await rows("PRAGMA foreign_key_list(actor_qualifications)")).toEqual([
    expect.objectContaining({
      from: "memberships_id",
      table: "memberships",
      to: "id",
      on_delete: "CASCADE",
      on_update: "NO ACTION",
    }),
  ]);
  expect(
    (await rows<{ name: string }>("PRAGMA index_info(actor_qualification_membership_kind)")).map(
      (props) => props.name,
    ),
  ).toEqual(["memberships_id", "actor_kind"]);
  expect(await rows("PRAGMA index_list(actor_qualifications)")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "actor_qualification_membership_kind", unique: 1 }),
    ]),
  );
  expect(await rows("PRAGMA foreign_key_check")).toEqual([]);
});

it.each([
  [
    "所属のない資格",
    "INSERT INTO actor_qualifications (id,memberships_id,actor_kind,active) VALUES ('missing-parent','missing-member','business',1)",
    /FOREIGN KEY constraint failed/,
  ],
  [
    "不正な主体区分",
    "INSERT INTO actor_qualifications (id,memberships_id,actor_kind,active) VALUES ('invalid-kind','legacy-tenant-member','superuser',1)",
    /CHECK constraint failed/,
  ],
  [
    "不正な有効状態",
    "INSERT INTO actor_qualifications (id,memberships_id,actor_kind,active) VALUES ('invalid-state','legacy-tenant-member','business',2)",
    /CHECK constraint failed/,
  ],
])("利用主体資格の既存DB移行 / %sをDB制約で拒否する", async (_label, statement, message) => {
  await expect(platform.env.DB.prepare(statement).run()).rejects.toThrow(message);
});

it("利用主体資格の既存DB移行 / 資格の二重作成を拒否し所属削除で資格も削除する", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO accounts (id,name,email,deleted) VALUES ('cascade-account','カスケード確認',NULL,0)",
  ).run();
  await platform.env.DB.prepare(
    "INSERT INTO memberships (id,scope,accounts_id,access_roles_id) VALUES ('cascade-member','legacy-tenant','cascade-account','legacy-tenant-role')",
  ).run();
  await platform.env.DB.prepare(
    "INSERT INTO actor_qualifications (id,memberships_id,actor_kind,active) VALUES ('cascade-business','cascade-member','business',1),('cascade-customer','cascade-member','customer',1)",
  ).run();
  await expect(
    platform.env.DB.prepare(
      "INSERT INTO actor_qualifications (id,memberships_id,actor_kind,active) VALUES ('duplicate-business','cascade-member','business',0)",
    ).run(),
  ).rejects.toThrow(/UNIQUE constraint failed/);
  await platform.env.DB.prepare("DELETE FROM memberships WHERE id='cascade-member'").run();
  expect(
    await rows("SELECT * FROM actor_qualifications WHERE memberships_id='cascade-member'"),
  ).toEqual([]);
  expect(await rows("PRAGMA foreign_key_check")).toEqual([]);
});
