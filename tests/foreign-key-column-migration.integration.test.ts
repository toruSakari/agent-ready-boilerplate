// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  invitations,
  legacyMemberships as memberships,
  rolePermissions,
} from "#api/infrastructure/access/schemas/schema.ts";
import { orderStatusAssignments } from "#api/infrastructure/order/schemas/schema.ts";
import { productImages } from "#api/infrastructure/product/schemas/schema.ts";

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL("../apps/api/drizzle", import.meta.url));
const NOW = "2026-10-04T00:00:00.000Z";
const SETUP_TIMEOUT_MS = 30_000;
const RENAMES = [
  ["memberships", "user_id", "accounts_id", "accounts", "id", "NO ACTION"],
  ["memberships", "role_id", "access_roles_id", "access_roles", "id", "NO ACTION"],
  ["role_permissions", "role_id", "access_roles_id", "access_roles", "id", "NO ACTION"],
  ["role_permissions", "permission", "permissions_id", "permissions", "code", "NO ACTION"],
  ["invitations", "role_id", "access_roles_id", "access_roles", "id", "NO ACTION"],
  ["order_status_assignments", "order_id", "orders_id", "orders", "id", "CASCADE"],
  [
    "order_status_assignments",
    "status_code",
    "order_statuses_id",
    "order_statuses",
    "code",
    "RESTRICT",
  ],
  ["product_images", "product_id", "products_id", "products", "id", "RESTRICT"],
] as const;
const ORM_TABLES = [
  memberships,
  rolePermissions,
  invitations,
  orderStatusAssignments,
  productImages,
];
const EXPECTED_EDGES = RENAMES.map((props) => {
  const [tableFrom, , from, table, to, onDelete] = props;
  return {
    tableFrom,
    from,
    table,
    to,
    on_delete: onDelete,
    on_update: "NO ACTION",
  };
});

type TestBindings = { UPGRADED_DB: D1Database; FRESH_DB: D1Database };

type Row = Record<string, string | number | null>;

type Column = { name: string; type: string; notnull: number; pk: number };

type ForeignKey = {
  from: string;
  table: string;
  to: string;
  on_delete: string;
  on_update: string;
};

type Snapshot = {
  id: string;
  prevId: string;
  tables: Record<
    string,
    {
      columns: Record<
        string,
        { name: string; type: string; notNull: boolean; primaryKey: boolean }
      >;
      indexes: Record<string, { name: string; columns: string[]; isUnique: boolean }>;
      foreignKeys: Record<
        string,
        {
          tableFrom: string;
          tableTo: string;
          columnsFrom: string[];
          columnsTo: string[];
          onDelete: string;
          onUpdate: string;
        }
      >;
    }
  >;
};

let platform: Awaited<ReturnType<typeof getPlatformProxy<TestBindings>>>;
let beforeRows: Record<string, Row[]>;
let afterRows: Record<string, Row[]>;
let beforeColumns: Record<string, Column[]>;
let tableNames: string[];
let latestMigration: string;

function renamedColumn(table: string, column: string) {
  return RENAMES.find((props) => props[0] === table && props[1] === column)?.[2] ?? column;
}

async function rows<T>(db: D1Database, sql: string) {
  return (await db.prepare(sql).all<T>()).results;
}

async function applyMigration(db: D1Database, file: string) {
  const statements = readFileSync(join(MIGRATIONS_DIRECTORY, file), "utf8")
    .split(";")
    .map((statement) => statement.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
  await db.batch(statements.map((statement) => db.prepare(statement)));
}

async function allRows(db: D1Database) {
  return Object.fromEntries(
    await Promise.all(
      tableNames.map(async (table) => [
        table,
        await rows<Row>(db, `SELECT * FROM ${table} ORDER BY rowid`),
      ]),
    ),
  );
}

async function allColumns(db: D1Database) {
  return Object.fromEntries(
    await Promise.all(
      tableNames.map(async (table) => [
        table,
        await rows<Column>(db, `PRAGMA table_info(${table})`),
      ]),
    ),
  );
}

async function allForeignKeys(db: D1Database) {
  return (
    await Promise.all(
      tableNames.map(async (tableFrom) =>
        (await rows<ForeignKey>(db, `PRAGMA foreign_key_list(${tableFrom})`)).map((props) => ({
          tableFrom,
          from: props.from,
          table: props.table,
          to: props.to,
          on_delete: props.on_delete,
          on_update: props.on_update,
        })),
      ),
    )
  ).flat();
}

beforeAll(async () => {
  platform = await getPlatformProxy<TestBindings>({
    configPath: fileURLToPath(new URL("./wrangler.foreign-keys-test.jsonc", import.meta.url)),
    persist: false,
  });
  const migrations = readdirSync(MIGRATIONS_DIRECTORY)
    .filter((name) => name.endsWith(".sql") && Number(name.slice(0, 4)) <= 12)
    .sort();
  const legacyMigrations = migrations.filter((name) => Number(name.slice(0, 4)) <= 11);
  const renameMigrations = migrations.filter((name) => name.startsWith("0012_"));
  expect(legacyMigrations).toHaveLength(12);
  expect(renameMigrations).toHaveLength(1);
  latestMigration = renameMigrations[0]!;
  const db = platform.env.UPGRADED_DB;
  for (const migration of legacyMigrations) {
    if (migration.startsWith("0010_")) {
      for (const id of ["legacy-product-a", "legacy-product-b", "legacy-product-empty"]) {
        await db
          .prepare(`
          INSERT INTO products (id, tenant_id, sku, name, unit_price, image_key, created_at)
          VALUES (?, 'legacy-tenant', ?, '既存商品', 125, ?, ?)
        `)
          .bind(id, id, id.endsWith("empty") ? null : "legacy/shared-object", NOW)
          .run();
      }
    }

    await applyMigration(db, migration);
  }

  await db.batch([...legacyIdentityStatements(db), ...legacyCommerceStatements(db)]);
  tableNames = (
    await rows<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    )
  ).map((props) => props.name);
  // 改名対象だけを期待値で変換し、その他の行・値・制約が移行で失われていないか照合する。
  beforeRows = await allRows(db);
  beforeColumns = await allColumns(db);
  await applyMigration(db, latestMigration);
  afterRows = await allRows(db);
  for (const migration of migrations) {
    await applyMigration(platform.env.FRESH_DB, migration);
  }
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await platform?.dispose();
});

it("外部キー列名のD1移行 / 0011までの全テーブルの行・値と共有画像キーのバックフィルを保つ", () => {
  expect(beforeRows.product_images).toHaveLength(3);
  expect(
    beforeRows.product_images?.filter((props) => props.image_key === "legacy/shared-object"),
  ).toHaveLength(2);
  expect(beforeRows.memberships).toHaveLength(1);
  expect(beforeRows.role_permissions).toHaveLength(1);
  expect(beforeRows.invitations).toHaveLength(1);
  expect(beforeRows.order_status_assignments).toHaveLength(1);
  for (const table of tableNames) {
    expect(afterRows[table]).toEqual(
      beforeRows[table]!.map((row) =>
        Object.fromEntries(
          Object.entries(row).map((props) => [renamedColumn(table, props[0]), props[1]]),
        ),
      ),
    );
  }

  expect(afterRows.role_permissions?.[0]?.permissions_id).toBe("order:read");
  expect(afterRows.order_status_assignments?.[0]?.order_statuses_id).toBe("confirmed");
});

it.each(["UPGRADED_DB", "FRESH_DB"] as const)(
  "外部キー列名のD1移行 / %sの外部キーは8本のままで、参照先と削除動作を保つ",
  async (binding) => {
    const db = platform.env[binding];
    const edges = await allForeignKeys(db);
    expect(edges).toHaveLength(RENAMES.length);
    expect(edges).toEqual(expect.arrayContaining(EXPECTED_EDGES));
    expect(await rows(db, "PRAGMA foreign_key_check")).toEqual([]);
    expect(await db.prepare("PRAGMA foreign_keys").first<number>("foreign_keys")).toBe(1);
    const columns = await allColumns(db);
    for (const table of tableNames) {
      expect(columns[table]).toEqual(
        beforeColumns[table]!.map((column) => ({
          ...column,
          name: renamedColumn(table, column.name),
        })),
      );
    }
  },
);

it("外部キー列名のD1移行 / インデックスと主キーが変更後の列を指し、一意性を維持する", async () => {
  const db = platform.env.UPGRADED_DB;
  const expectedIndexes = [
    ["membership_scope_user", "memberships", ["scope", "accounts_id"], 1],
    ["role_permission_unique", "role_permissions", ["access_roles_id", "permissions_id"], 1],
    ["invitations_token_hash_unique", "invitations", ["token_hash"], 1],
    ["order_status_assignments_status_idx", "order_status_assignments", ["order_statuses_id"], 0],
    ["product_images_product_state", "product_images", ["tenant_id", "products_id", "state"], 0],
    ["product_images_key", "product_images", ["image_key"], 0],
    ["product_images_cleanup", "product_images", ["state", "delete_after", "claimed_until"], 0],
  ] as const;
  for (const [index, table, columns, unique] of expectedIndexes) {
    expect(
      (await rows<{ name: string }>(db, `PRAGMA index_info(${index})`)).map((props) => props.name),
    ).toEqual(columns);
    expect(await rows(db, `PRAGMA index_list(${table})`)).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: index, unique })]),
    );
  }

  const duplicates = [
    "INSERT INTO memberships (id, scope, accounts_id, access_roles_id) SELECT 'duplicate-membership', scope, accounts_id, access_roles_id FROM memberships WHERE id = 'legacy-membership'",
    "INSERT INTO role_permissions (id, access_roles_id, permissions_id) SELECT 'duplicate-permission', access_roles_id, permissions_id FROM role_permissions WHERE id = 'legacy-role-permission'",
    "INSERT INTO invitations (id, scope, email, access_roles_id, token_hash, expires_at, inviter_id) SELECT 'duplicate-invitation', scope, email, access_roles_id, token_hash, expires_at, inviter_id FROM invitations WHERE id = 'legacy-invitation'",
    "INSERT INTO order_status_assignments SELECT * FROM order_status_assignments WHERE orders_id = 'legacy-order'",
  ];
  for (const sql of duplicates) {
    await expect(db.prepare(sql).run()).rejects.toThrow(/UNIQUE constraint failed/);
  }
});

it.each(RENAMES)(
  "外部キー列名のD1移行 / %s.%sの改名後も存在しない参照を拒否する",
  async (table, _oldColumn, newColumn) => {
    await expect(
      platform.env.UPGRADED_DB.prepare(`UPDATE ${table} SET ${newColumn} = 'missing-parent'`).run(),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
  },
);

it("外部キー列名のD1移行 / 参照中のマスター削除を引き続き拒否する", async () => {
  for (const [table, column, value] of [
    ["accounts", "id", "legacy-account"],
    ["access_roles", "id", "legacy-role"],
    ["permissions", "code", "order:read"],
    ["order_statuses", "code", "confirmed"],
    ["products", "id", "legacy-product-a"],
  ]) {
    await expect(
      platform.env.UPGRADED_DB.prepare(`DELETE FROM ${table} WHERE ${column} = ?`)
        .bind(value)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
  }
});

it("外部キー列名のD1移行 / 注文削除だけが状態割当へカスケードし、外部キーのない履歴は保持する", async () => {
  const db = platform.env.UPGRADED_DB;
  await db
    .prepare(
      "INSERT INTO orders (id, tenant_id, customer_id, lines, total, created_at) VALUES ('cascade-order', 'legacy-tenant', 'customer', '[]', 0, ?)",
    )
    .bind(NOW)
    .run();
  await db
    .prepare(
      "INSERT INTO order_status_assignments (orders_id, order_statuses_id, updated_at) VALUES ('cascade-order', 'draft', ?)",
    )
    .bind(NOW)
    .run();
  await db
    .prepare(
      "INSERT INTO order_event_history (event_id, tenant_id, order_id, event_type, occurred_at, processed_at) VALUES ('cascade-history', 'legacy-tenant', 'cascade-order', 'OrderCreated', ?, ?)",
    )
    .bind(NOW, NOW)
    .run();
  await db.prepare("DELETE FROM orders WHERE id = 'cascade-order'").run();
  expect(
    await rows(db, "SELECT * FROM order_status_assignments WHERE orders_id = 'cascade-order'"),
  ).toEqual([]);
  expect(
    await rows(db, "SELECT * FROM order_event_history WHERE order_id = 'cascade-order'"),
  ).toHaveLength(1);
  expect(await rows(db, "PRAGMA foreign_key_check")).toEqual([]);
});

it("外部キー列名のD1移行 / Drizzle定義・0012スナップショット・D1の列と外部キーが一致する", async () => {
  const previous = JSON.parse(
    readFileSync(join(MIGRATIONS_DIRECTORY, "meta/0011_snapshot.json"), "utf8"),
  ) as Snapshot;
  const snapshot = JSON.parse(
    readFileSync(join(MIGRATIONS_DIRECTORY, "meta/0012_snapshot.json"), "utf8"),
  ) as Snapshot;
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIRECTORY, "meta/_journal.json"), "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  expect(snapshot.prevId).toBe(previous.id);
  expect(journal.entries.find((props) => props.idx === 12)?.tag).toBe(
    latestMigration.replace(/\.sql$/, ""),
  );
  const db = platform.env.UPGRADED_DB;
  for (const table of ORM_TABLES) {
    const config = getTableConfig(table);
    const snapshotTable = snapshot.tables[config.name]!;
    await assertRenamedColumns(db, table, snapshotTable);
    assertRenamedForeignKeys(table, snapshotTable);
    await assertRenamedIndexesAndRows(db, table, snapshotTable);
  }
});

function legacyIdentityStatements(db: D1Database) {
  return [
    db.prepare(
      "INSERT INTO accounts VALUES ('legacy-account', '既存ユーザー', 'legacy@example.test', 0)",
    ),
    db.prepare("INSERT INTO access_roles VALUES ('legacy-role', 'legacy-tenant', '既存ロール', 0)"),
    db.prepare(
      "INSERT INTO memberships (id, scope, user_id, role_id) VALUES ('legacy-membership', 'legacy-tenant', 'legacy-account', 'legacy-role')",
    ),
    db.prepare(
      "INSERT INTO role_permissions (id, role_id, permission) VALUES ('legacy-role-permission', 'legacy-role', 'order:read')",
    ),
  ];
}

function legacyCommerceStatements(db: D1Database) {
  return [
    db
      .prepare(
        "INSERT INTO invitations (id, scope, email, role_id, token_hash, expires_at, inviter_id) VALUES ('legacy-invitation', 'legacy-tenant', 'invited@example.test', 'legacy-role', 'legacy-token', ?, 'legacy-account')",
      )
      .bind(NOW),
    db
      .prepare(
        "INSERT INTO orders (id, tenant_id, customer_id, lines, total, created_at) VALUES ('legacy-order', 'legacy-tenant', 'legacy-customer', ?, 125, ?)",
      )
      .bind(JSON.stringify([{ sku: "legacy-product-a", imageKey: "legacy/shared-object" }]), NOW),
    db
      .prepare(
        "INSERT INTO order_status_assignments (order_id, status_code, updated_at) VALUES ('legacy-order', 'confirmed', ?)",
      )
      .bind(NOW),
    db
      .prepare(
        "INSERT INTO product_images (id, tenant_id, product_id, image_key, state, created_at, removed_at, mutation_id, delete_after, claim_token, claimed_until) VALUES ('retired-image', 'legacy-tenant', 'legacy-product-a', 'legacy/retired-object', 'retired', ?, ?, 'mutation', ?, 'claim', ?)",
      )
      .bind(NOW, NOW, NOW, NOW),
    db
      .prepare(
        "INSERT INTO payments (id, tenant_id, order_id, amount, currency, status, authorization_id, order_version, created_at, updated_at) VALUES ('legacy-payment', 'legacy-tenant', 'legacy-order', 125, 'JPY', 'authorized', 'legacy-authorization', 0, ?, ?)",
      )
      .bind(NOW, NOW),
    db
      .prepare(
        "INSERT INTO inventory_allocations (id, order_id, sku, quantity, committed_at, tenant_id) VALUES ('legacy-allocation', 'legacy-order', 'legacy-product-a', 1, ?, 'legacy-tenant')",
      )
      .bind(NOW),
    db
      .prepare(
        "INSERT INTO order_event_history (event_id, tenant_id, order_id, event_type, occurred_at, processed_at) VALUES ('legacy-event', 'legacy-tenant', 'legacy-order', 'OrderConfirmed', ?, ?)",
      )
      .bind(NOW, NOW),
    db
      .prepare(
        "INSERT INTO access_audit VALUES ('legacy-audit', 'legacy-account', 'legacy-tenant', 'member.created', 'legacy-membership', ?)",
      )
      .bind(NOW),
  ];
}

async function assertRenamedColumns(
  db: D1Database,
  table: (typeof ORM_TABLES)[number],
  snapshotTable: Snapshot["tables"][string],
) {
  const config = getTableConfig(table);
  const actualColumns = await rows<Column>(db, `PRAGMA table_info(${config.name})`);
  // 0012時点の回帰条件を保つため、後の移行で増えた列は別のテストに任せる。
  const expectedColumns = config.columns
    .filter((column) => column.name in snapshotTable.columns)
    .map((column) => ({
      name: column.name,
      type: column.getSQLType().toLowerCase(),
      notnull: Number(column.notNull),
      pk: Number(column.primary),
    }));
  expect(
    actualColumns.map((props) => ({
      name: props.name,
      type: props.type.toLowerCase(),
      notnull: props.notnull,
      pk: props.pk,
    })),
  ).toEqual(expectedColumns);
  expect(
    Object.values(snapshotTable.columns).map((props) => ({
      name: props.name,
      type: props.type,
      notnull: Number(props.notNull),
      pk: Number(props.primaryKey),
    })),
  ).toEqual(expectedColumns);
}

function assertRenamedForeignKeys(
  table: (typeof ORM_TABLES)[number],
  snapshotTable: Snapshot["tables"][string],
) {
  const config = getTableConfig(table);
  const ormEdges = config.foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    return {
      tableFrom: config.name,
      from: reference.columns[0]!.name,
      table: getTableName(reference.foreignTable),
      to: reference.foreignColumns[0]!.name,
      on_delete: (foreignKey.onDelete ?? "no action").toUpperCase(),
      on_update: (foreignKey.onUpdate ?? "no action").toUpperCase(),
    };
  });
  expect(ormEdges).toEqual(
    expect.arrayContaining(EXPECTED_EDGES.filter((props) => props.tableFrom === config.name)),
  );
  expect(
    Object.values(snapshotTable.foreignKeys).map((foreignKey) => ({
      tableFrom: foreignKey.tableFrom,
      from: foreignKey.columnsFrom[0],
      table: foreignKey.tableTo,
      to: foreignKey.columnsTo[0],
      on_delete: foreignKey.onDelete.toUpperCase(),
      on_update: foreignKey.onUpdate.toUpperCase(),
    })),
  ).toEqual(ormEdges);
}

async function assertRenamedIndexesAndRows(
  db: D1Database,
  table: (typeof ORM_TABLES)[number],
  snapshotTable: Snapshot["tables"][string],
) {
  const config = getTableConfig(table);
  for (const index of Object.values(snapshotTable.indexes)) {
    expect(
      (await rows<{ name: string }>(db, `PRAGMA index_info(${index.name})`)).map(
        (props) => props.name,
      ),
    ).toEqual(index.columns);
  }

  const historicalColumns = Object.fromEntries(
    Object.entries(getTableColumns(table)).filter((props) => {
      const [, column] = props;
      return column.name in snapshotTable.columns;
    }),
  );
  expect(await drizzle(db).select(historicalColumns).from(table)).toHaveLength(
    afterRows[config.name]!.length,
  );
}
