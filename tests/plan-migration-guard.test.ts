// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { assertPlanMigrationReady } from "@/apps/api/tooling/plan-migration-guard";

// 配備可否は列と権限定義の存在を確認する。会員へのプラン割当は別のseed検証で扱う。
const ready = (sql: string) =>
  sql.includes("table_info") ? [{ name: "id" }, { name: "plan_code" }] : [{ code: "plan.manage" }];
describe("プランschemaの事前確認", () => {
  it("完全に空のDBはschema追加前でも許可する", () =>
    expect(() => assertPlanMigrationReady(() => [])).not.toThrow());
  it("参照列とpermission定義を確認する", () =>
    expect(() => assertPlanMigrationReady(ready)).not.toThrow());
  it.each(["organizations", "customer_accounts"])("%sだけ旧schemaでも停止する", (table) =>
    expect(() =>
      assertPlanMigrationReady((sql) =>
        sql.includes(`'${table}'`) ? [{ name: "id" }] : ready(sql),
      ),
    ).toThrow(/0015/),
  );
  it("permission定義がなければ停止する", () =>
    expect(() =>
      assertPlanMigrationReady((sql) => (sql.includes("SELECT code") ? [] : ready(sql))),
    ).toThrow(/0016/));
  it("別テーブルがあるDBは空ではない", () =>
    expect(() =>
      assertPlanMigrationReady((sql) => (sql.includes("sqlite_master") ? [{ name: "other" }] : [])),
    ).toThrow(/0015/));
});
