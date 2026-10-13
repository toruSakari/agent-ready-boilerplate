// @vitest-environment node
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { guardedInsert } from "#api/infrastructure/shared/guarded-insert.ts";

const fixture = sqliteTable("guarded_insert_fixture", {
  id: text().primaryKey(),
  enabled: integer({ mode: "boolean" }).notNull().default(true),
  label: text().notNull(),
  note: text(),
});
let platform: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: new URL("../access/repositories/wrangler.access-test.jsonc", import.meta.url)
      .pathname,
    persist: false,
  });
  await platform.env.DB.exec(
    "CREATE TABLE guarded_insert_fixture (id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, label TEXT NOT NULL, note TEXT)",
  );
}, 30_000);
afterAll(async () => {
  await platform?.dispose();
});
it("条件付きINSERTはbooleanと既定値をエンコードし入力をSQLへ展開しない", async () => {
  const db = drizzle(platform.env.DB);
  const label = "'); DROP TABLE guarded_insert_fixture; --";
  await guardedInsert(db, fixture, { id: "default", label }, sql`1`);
  await guardedInsert(
    db,
    fixture,
    { id: "false", enabled: false, label: sql`upper(${"label"})` },
    sql`1`,
  );
  expect(await db.select().from(fixture).orderBy(fixture.id)).toEqual([
    { id: "default", enabled: true, label, note: null },
    { id: "false", enabled: false, label: "LABEL", note: null },
  ]);
  expect(
    await platform.env.DB.prepare("SELECT enabled FROM guarded_insert_fixture ORDER BY id").all(),
  ).toMatchObject({ results: [{ enabled: 1 }, { enabled: 0 }] });
});
it("条件に負けたINSERTは既存行のupsertも新規行の追加もしない", async () => {
  const db = drizzle(platform.env.DB);
  await db.insert(fixture).values({ id: "winner", label: "original" });
  const values = { id: "winner", label: "overwritten" };
  const [updated, inserted] = await db.batch([
    guardedInsert(db, fixture, values, sql`0`)
      .onConflictDoUpdate({ target: fixture.id, set: { label: "overwritten" } })
      .returning(),
    guardedInsert(db, fixture, { id: "loser", label: "new" }, sql`0`).returning(),
  ]);
  expect(updated).toEqual([]);
  expect(inserted).toEqual([]);
  expect(await db.select().from(fixture).where(eq(fixture.id, "winner"))).toMatchObject([
    { label: "original" },
  ]);
});
it("D1 batchの後続INSERT失敗は先行更新もロールバックする", async () => {
  const db = drizzle(platform.env.DB);
  await db.insert(fixture).values({ id: "atomic", label: "before" });
  await expect(
    db.batch([
      db.update(fixture).set({ label: "after" }).where(eq(fixture.id, "atomic")),
      guardedInsert(db, fixture, { id: "atomic", label: "duplicate" }, sql`1`),
    ]),
  ).rejects.toThrow();
  expect(await db.select().from(fixture).where(eq(fixture.id, "atomic"))).toMatchObject([
    { label: "before" },
  ]);
});
