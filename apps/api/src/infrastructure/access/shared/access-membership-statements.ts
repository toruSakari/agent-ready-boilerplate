import { and, or, eq, exists } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BatchItem } from "drizzle-orm/batch";
import type { AccessChange } from "#api/domain/access/repositories/access-repository.ts";
import { accountTables } from "#api/infrastructure/access/shared/access-record-selections.ts";
import { guardedInsert } from "#api/infrastructure/shared/guarded-insert.ts";
import {
  invitations,
  customerMemberships,
  businessMemberships,
  operatorMemberships,
} from "#api/infrastructure/access/schemas/schema.ts";

export const membershipTables = {
  customer: {
    table: customerMemberships,
    scope: customerMemberships.organizationsId,
    account: customerMemberships.customerAccountsId,
  },
  business: {
    table: businessMemberships,
    scope: businessMemberships.organizationsId,
    account: businessMemberships.businessAccountsId,
  },
  operator: {
    table: operatorMemberships,
    scope: operatorMemberships.scope,
    account: operatorMemberships.operatorAccountsId,
  },
};

export function membershipStatements(db: DrizzleD1Database, change: AccessChange, guard: SQL) {
  const statements: BatchItem<"sqlite">[] = [];
  for (const m of change.memberships ?? []) {
    const account = accountTables[m.category as keyof typeof accountTables];
    const active = and(
      guard,
      exists(
        db
          .select({ id: account.id })
          .from(account)
          .where(and(eq(account.id, m.userId), eq(account.deleted, false))),
      ),
    )!;
    statements.push(membershipUpsert(db, m, active));
  }

  for (const i of change.invitations ?? []) {
    statements.push(
      guardedInsert(
        db,
        invitations,
        {
          id: i.id,
          scope: i.scope,
          email: i.email,
          accessRolesId: i.roleId,
          tokenHash: i.tokenHash,
          expiresAt: i.expiresAt,
          inviterId: i.inviterId,
          actorKind: i.actorKind,
          inviterChannel: i.inviterChannel,
        },
        guard,
      ),
    );
  }

  return statements;
}

export function removalStatements(db: DrizzleD1Database, change: AccessChange, guard: SQL) {
  const statements: BatchItem<"sqlite">[] = [];
  for (const id of change.removeMembershipIds ?? []) {
    for (const category of ["customer", "business", "operator"] as const) {
      const m = membershipTables[category];
      const a = accountTables[category];
      const scope = db.select({ scope: m.scope }).from(m.table).where(eq(m.table.id, id));
      const email = db
        .select({ email: a.email })
        .from(m.table)
        .innerJoin(a, eq(a.id, m.account))
        .where(eq(m.table.id, id));
      statements.push(
        db
          .delete(invitations)
          .where(
            and(
              eq(invitations.actorKind, category),
              eq(invitations.scope, scope),
              eq(invitations.email, email),
              guard,
            ),
          ),
        db.delete(m.table).where(and(eq(m.table.id, id), guard)),
      );
    }
  }

  for (const id of change.removeInvitationIds ?? []) {
    statements.push(db.delete(invitations).where(and(eq(invitations.id, id), guard)));
  }

  return statements;
}

export function withdrawalStatements(db: DrizzleD1Database, change: AccessChange, guard: SQL) {
  const statements: BatchItem<"sqlite">[] = [];
  for (const account of [
    change.withdrawnCustomerAccount,
    change.withdrawnBusinessAccount,
    change.stoppedOperatorAccount,
  ]) {
    if (!account) {
      continue;
    }

    const table = accountTables[account.category];
    const m = membershipTables[account.category];
    const email = db.select({ email: table.email }).from(table).where(eq(table.id, account.id));
    statements.push(
      db
        .delete(invitations)
        .where(
          and(
            or(
              and(eq(invitations.actorKind, account.category), eq(invitations.email, email)),
              eq(invitations.inviterId, account.id),
            ),
            guard,
          ),
        ),
      db.delete(m.table).where(and(eq(m.account, account.id), guard)),
      db
        .update(table)
        .set({ deleted: account.deleted, name: account.name, email: account.email })
        .where(and(eq(table.id, account.id), guard)),
    );
  }

  return statements;
}

function membershipUpsert(
  db: DrizzleD1Database,
  m: NonNullable<AccessChange["memberships"]>[number],
  active: SQL,
) {
  // サービスごとに列と入力型が異なるため、型を消した汎用挿入へ統合しない。
  if (m.category === "business") {
    return guardedInsert(
      db,
      businessMemberships,
      {
        id: m.id,
        organizationsId: m.scope,
        businessAccountsId: m.userId,
        accessRolesId: m.roleId,
      },
      active,
    ).onConflictDoUpdate({
      target: [businessMemberships.organizationsId, businessMemberships.businessAccountsId],
      set: { accessRolesId: m.roleId },
    });
  } else if (m.category === "operator") {
    return guardedInsert(
      db,
      operatorMemberships,
      { id: m.id, scope: m.scope, operatorAccountsId: m.userId, accessRolesId: m.roleId },
      active,
    ).onConflictDoUpdate({
      target: [operatorMemberships.scope, operatorMemberships.operatorAccountsId],
      set: { accessRolesId: m.roleId },
    });
  }

  throw new Error("一般ユーザーの企業所属は保存できません");
}
