import { and, eq, gte, lt, or, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { OrderFilters } from "#api/domain/shared/list-filters.ts";

/** 部分一致をパラメーター化し、%や_をワイルドカードとして扱わない。 */
export function textSearch(columns: AnySQLiteColumn[], text?: string) {
  return text
    ? or(...columns.map((column) => sql`instr(lower(${column}), lower(${text})) > 0`))
    : undefined;
}

export function orderConditions(
  columns: { id: AnySQLiteColumn; createdAt: AnySQLiteColumn; status: AnySQLiteColumn },
  filters: OrderFilters,
) {
  // 日付は日本時間の暦日。終了日の翌日未満にし、その日の注文を最後まで含む。
  const end = filters.to ? new Date(`${filters.to}T00:00:00+09:00`) : undefined;
  end?.setUTCDate(end.getUTCDate() + 1);
  return and(
    textSearch([columns.id], filters.search),
    filters.status ? eq(columns.status, filters.status) : undefined,
    filters.from
      ? gte(columns.createdAt, new Date(`${filters.from}T00:00:00+09:00`).toISOString())
      : undefined,
    end ? lt(columns.createdAt, end.toISOString()) : undefined,
  );
}
