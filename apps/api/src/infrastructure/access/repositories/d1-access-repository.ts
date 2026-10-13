import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, exists, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  invitations,
  accessRevision,
  organizations,
  accessRoles,
  rolePermissions,
  customerAccounts,
  businessAccounts,
  operatorAccounts,
  auditEntries,
} from "#api/infrastructure/access/schemas/schema.ts";
import {
  storedColumns,
  accountCategoryColumn,
  accountDeletedColumn,
  membershipCategoryColumn,
  accessAccounts,
  accessMemberships,
} from "#api/infrastructure/access/shared/access-record-selections.ts";
import type {
  AccessChange,
  AccessRepository,
  AuditEntry,
  AccessRecords,
} from "#api/domain/access/repositories/access-repository.ts";
import {
  restoreInvitation,
  restoreAccessRecords,
} from "#api/infrastructure/access/mappers/restore-access-records.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import type { BatchItem } from "drizzle-orm/batch";
import { guardedInsert } from "#api/infrastructure/shared/guarded-insert.ts";
import {
  membershipStatements,
  removalStatements,
  withdrawalStatements,
} from "#api/infrastructure/access/shared/access-membership-statements.ts";

const excluded = (column: { name: string }) => sql`excluded.${sql.identifier(column.name)}`;

export class D1AccessRepository implements AccessRepository {
  constructor(private readonly db: D1Database) {}

  async load(scope: string): Promise<AccessRecords> {
    const db = drizzle(this.db);
    const global = scope === PLATFORM_SCOPE;
    const accounts = accessAccounts(db);
    const memberships = accessMemberships(db);
    const rows = await db.batch([
      db
        .select({ version: accessRevision.version })
        .from(accessRevision)
        .where(eq(accessRevision.id, "access")),
      db
        .select(storedColumns(organizations))
        .from(organizations)
        .where(global ? undefined : eq(organizations.id, scope)),
      snapshotAccounts(db, accounts, memberships, global, scope),
      db
        .select(storedColumns(accessRoles))
        .from(accessRoles)
        .where(global ? undefined : eq(accessRoles.scope, scope)),
      snapshotPermissions(db, global, scope),
      db
        .select()
        .from(memberships)
        .where(global ? undefined : eq(memberships.scope, scope)),
      db
        .select(storedColumns(invitations))
        .from(invitations)
        .where(global ? undefined : eq(invitations.scope, scope)),
    ]);
    return restoreAccessRecords(rows.map((results) => ({ results })));
  }

  /** 判断に使った版に勝った変更と監査だけを、同じD1 batchで保存する。 */
  async commit(version: number, change: AccessChange, audit: AuditEntry) {
    if (change.memberships?.some((m) => m.category === "customer")) {
      throw new Error("一般ユーザーの企業所属は保存できません");
    }

    const db = drizzle(this.db);
    // 監査IDの再利用でも前回の勝者を参照しないよう、保存試行ごとに識別子を生成する。
    const mutationId = crypto.randomUUID();
    const guard = exists(
      db
        .select({ id: accessRevision.id })
        .from(accessRevision)
        .where(and(eq(accessRevision.id, "access"), eq(accessRevision.mutationId, mutationId))),
    );
    const statements: BatchItem<"sqlite">[] = [
      ...organizationStatements(db, change, guard),
      ...accountStatements(db, change, guard),
      ...roleStatements(db, change, guard),
      ...planStatements(db, change, guard),
      ...membershipStatements(db, change, guard),
      ...removalStatements(db, change, guard),
      ...withdrawalStatements(db, change, guard),
      guardedInsert(db, auditEntries, audit, guard),
    ];
    const [winner] = await db.batch([
      db
        .update(accessRevision)
        .set({ version: sql`${accessRevision.version}+1`, mutationId })
        .where(and(eq(accessRevision.id, "access"), eq(accessRevision.version, version)))
        .returning({ id: accessRevision.id }),
      ...statements,
    ]);
    return winner.length === 1;
  }

  async findInvitation(tokenHash: string) {
    const db = drizzle(this.db);
    const [value] = await db
      .select(storedColumns(invitations))
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);
    return value ? restoreInvitation(value) : null;
  }
}

function snapshotAccounts(
  db: ReturnType<typeof drizzle>,
  accounts: ReturnType<typeof accessAccounts>,
  memberships: ReturnType<typeof accessMemberships>,
  global: boolean,
  scope: string,
) {
  return db
    .select()
    .from(accounts)
    .where(
      global
        ? undefined
        : and(
            eq(accountDeletedColumn, 0),
            exists(
              db
                .select({ id: memberships.id })
                .from(memberships)
                .where(
                  and(
                    eq(memberships.accounts_id, accounts.id),
                    eq(membershipCategoryColumn, accountCategoryColumn),
                    eq(memberships.scope, scope),
                  ),
                ),
            ),
          ),
    );
}

function snapshotPermissions(db: DrizzleD1Database, global: boolean, scope: string) {
  return db
    .select(storedColumns(rolePermissions))
    .from(rolePermissions)
    .where(
      global
        ? undefined
        : exists(
            db
              .select({ id: accessRoles.id })
              .from(accessRoles)
              .where(
                and(
                  eq(accessRoles.id, rolePermissions.accessRolesId),
                  eq(accessRoles.scope, scope),
                ),
              ),
          ),
    );
}

function organizationStatements(db: DrizzleD1Database, change: AccessChange, guard: SQL) {
  return (change.organizations ?? []).map((o) =>
    guardedInsert(
      db,
      organizations,
      {
        id: o.id,
        name: o.name,
        active: o.active,
        invitationsEnabled: o.invitationsEnabled,
        businessIpRestrictionEnabled: o.businessIpRestrictionEnabled,
        businessAllowedIps: JSON.stringify(o.businessAllowedIps),
      },
      guard,
    ).onConflictDoUpdate({
      target: organizations.id,
      set: {
        name: excluded(organizations.name),
        active: excluded(organizations.active),
        invitationsEnabled: excluded(organizations.invitationsEnabled),
        businessIpRestrictionEnabled: excluded(organizations.businessIpRestrictionEnabled),
        businessAllowedIps: excluded(organizations.businessAllowedIps),
      },
    }),
  );
}

function accountStatements(db: DrizzleD1Database, change: AccessChange, guard: SQL) {
  const statements: BatchItem<"sqlite">[] = [];
  for (const { table, accounts } of [
    { table: customerAccounts, accounts: change.customerAccounts ?? [] },
    { table: businessAccounts, accounts: change.businessAccounts ?? [] },
    { table: operatorAccounts, accounts: change.operatorAccounts ?? [] },
  ]) {
    for (const a of accounts) {
      statements.push(
        guardedInsert(
          db,
          table,
          { id: a.id, subjectId: a.subjectId, name: a.name, email: a.email, deleted: a.deleted },
          guard,
        ).onConflictDoUpdate({
          target: table.id,
          set: { name: excluded(table.name), email: excluded(table.email) },
          setWhere: and(
            eq(table.deleted, false),
            eq(excluded(table.deleted), 0),
            eq(table.subjectId, excluded(table.subjectId)),
          ),
        }),
      );
    }
  }

  return statements;
}

function roleStatements(db: DrizzleD1Database, change: AccessChange, guard: SQL) {
  const statements: BatchItem<"sqlite">[] = [];
  for (const role of change.roles ?? []) {
    statements.push(
      guardedInsert(
        db,
        accessRoles,
        { id: role.id, scope: role.scope, name: role.name, protectedRole: role.protectedRole },
        guard,
      ).onConflictDoUpdate({ target: accessRoles.id, set: { name: excluded(accessRoles.name) } }),
      db.delete(rolePermissions).where(and(eq(rolePermissions.accessRolesId, role.id), guard)),
    );
    for (const permission of role.permissions) {
      statements.push(
        guardedInsert(
          db,
          rolePermissions,
          { id: `${role.id}:${permission}`, accessRolesId: role.id, permissionsId: permission },
          guard,
        ),
      );
    }
  }

  return statements;
}

function planStatements(db: DrizzleD1Database, change: AccessChange, guard: SQL) {
  return (change.planAssignments ?? []).map((assignment) => {
    const a = assignment.toSnapshot();
    const table = a.category === "business" ? organizations : customerAccounts;
    return db
      .update(table)
      .set({ planCode: a.planCode })
      .where(
        and(
          eq(table.id, a.id),
          a.category === "customer" ? eq(customerAccounts.deleted, false) : undefined,
          guard,
        ),
      );
  });
}
