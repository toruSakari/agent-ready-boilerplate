import { getTableColumns, is, Param, sql, SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQLiteTable, SQLiteInsertValue } from "drizzle-orm/sqlite-core";

/** SELECTする定数行をスキーマ順に組み立て、勝者の条件が成立した場合だけ挿入する。
 * insert().select(sql)の公式拡張点を使う。列名・型・値のエンコードはDrizzleが所有する。
 */
export function guardedInsert<T extends SQLiteTable>(
  db: DrizzleD1Database,
  table: T,
  values: SQLiteInsertValue<T>,
  guard: SQL,
) {
  const columns = getTableColumns(table);
  const row = Object.entries(columns).map((props) => {
    const value = values[props[0] as keyof typeof values];
    const resolved = value === undefined ? (props[1].default ?? null) : value;
    return is(resolved, SQL) ? resolved : new Param(resolved, props[1]);
  });
  return db.insert(table).select(
    sql`select ${sql.join(
      row.map((value) => sql`${value}`),
      sql`, `,
    )} where ${guard}`,
  );
}
