import { getTableColumns, sql } from "drizzle-orm";
import type { SQLiteTable, AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  customerAccounts,
  businessAccounts,
  operatorAccounts,
  businessMemberships,
  operatorMemberships,
} from "#api/infrastructure/access/schemas/schema.ts";

/** 保存値をそのまま検証するため、booleanデコーダーを通さずDB列名で選択する。 */
export function storedColumns(table: SQLiteTable) {
  return Object.fromEntries(
    Object.values(getTableColumns(table)).map((column) => [
      column.name,
      sql`${column}`.as(column.name),
    ]),
  );
}

export const accountTables = {
  customer: customerAccounts,
  business: businessAccounts,
  operator: operatorAccounts,
};

export function accessAccounts(db: DrizzleD1Database) {
  const selection = (
    table: typeof customerAccounts | typeof businessAccounts | typeof operatorAccounts,
    category: string,
  ) => ({
    id: table.id,
    subject_id: table.subjectId,
    name: table.name,
    email: table.email,
    deleted: sql`${table.deleted}`.as("deleted"),
    category: sql`${category}`.as("category"),
  });
  return db
    .select(selection(customerAccounts, "customer"))
    .from(customerAccounts)
    .unionAll(db.select(selection(businessAccounts, "business")).from(businessAccounts))
    .unionAll(db.select(selection(operatorAccounts, "operator")).from(operatorAccounts))
    .as("accounts");
}

function membershipSelection(
  id: AnySQLiteColumn,
  scope: AnySQLiteColumn,
  account: AnySQLiteColumn,
  role: AnySQLiteColumn,
  category: string,
) {
  return {
    id: id,
    scope: scope,
    accounts_id: account,
    access_roles_id: role,
    category: sql`${category}`.as("category"),
  };
}

function businessMembershipSelection(db: DrizzleD1Database) {
  return db
    .select(
      membershipSelection(
        businessMemberships.id,
        businessMemberships.organizationsId,
        businessMemberships.businessAccountsId,
        businessMemberships.accessRolesId,
        "business",
      ),
    )
    .from(businessMemberships);
}

function operatorMembershipSelection(db: DrizzleD1Database) {
  return db
    .select(
      membershipSelection(
        operatorMemberships.id,
        operatorMemberships.scope,
        operatorMemberships.operatorAccountsId,
        operatorMemberships.accessRolesId,
        "operator",
      ),
    )
    .from(operatorMemberships);
}

export function accessMemberships(db: DrizzleD1Database) {
  return businessMembershipSelection(db)
    .unionAll(operatorMembershipSelection(db))
    .as("memberships");
}

// SQLで作った計算列にはテーブル情報がないため、JOINで使う外側の参照を明示する。
export const accountCategoryColumn = sql`${sql.identifier("accounts")}.${sql.identifier("category")}`;
export const accountDeletedColumn = sql`${sql.identifier("accounts")}.${sql.identifier("deleted")}`;
export const membershipCategoryColumn = sql`${sql.identifier("memberships")}.${sql.identifier("category")}`;
