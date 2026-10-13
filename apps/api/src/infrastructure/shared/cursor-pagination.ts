import { and, asc, desc, eq, gt, gte, lt, lte, or } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { PageCursor } from "#api/domain/shared/page-request.ts";

/** 新しい日時・同時刻のID昇順に合わせ、削除された境界レコードも値だけで越える。 */
export function cursorPagination(
  columns: { createdAt: AnySQLiteColumn; id: AnySQLiteColumn },
  cursor?: PageCursor,
  sort: "newest" | "oldest" = "newest",
) {
  if (sort === "oldest") {
    return {
      after: cursor
        ? and(
            gte(columns.createdAt, cursor.createdAt),
            or(
              gt(columns.createdAt, cursor.createdAt),
              and(eq(columns.createdAt, cursor.createdAt), gt(columns.id, cursor.id)),
            ),
          )
        : undefined,
      order: [asc(columns.createdAt), asc(columns.id)],
    };
  }

  return {
    after: cursor
      ? and(
          // ORだけではSQLiteがテナントの先頭から走査するため、日時の範囲も明示する。
          lte(columns.createdAt, cursor.createdAt),
          or(
            lt(columns.createdAt, cursor.createdAt),
            and(eq(columns.createdAt, cursor.createdAt), gt(columns.id, cursor.id)),
          ),
        )
      : undefined,
    order: [desc(columns.createdAt), asc(columns.id)],
  };
}
