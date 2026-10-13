import { grantRows } from "#api/infrastructure/access/queries/access-grant-rows.ts";
import { ACCOUNT_CATEGORIES as categories } from "#api/domain/access/policies/account-categories.ts";
import { drizzle } from "drizzle-orm/d1";
import {
  and,
  or,
  eq,
  ne,
  asc,
  desc,
  exists,
  notExists,
  gte,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  accountTables,
  accountCategoryColumn,
  accountDeletedColumn,
  membershipCategoryColumn,
  accessAccounts,
  accessMemberships,
} from "#api/infrastructure/access/shared/access-record-selections.ts";
import {
  organizations,
  customerAccounts,
  accessRoles,
  invitations,
  auditEntries,
} from "#api/infrastructure/access/schemas/schema.ts";
import type { AccessQuerySource } from "#api/application/access/queries/access-query.ts";
import type { PlanOwner } from "#api/domain/access/entities/plan-assignment.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import { z } from "zod";

const flag = z.union([z.literal(0), z.literal(1)]).transform((v) => v === 1);
export const AUDIT_PAGE_SIZE = 100;

export class D1AccessQuery implements AccessQuerySource {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async planCode(owner: PlanOwner) {
    const table = owner.category === "business" ? organizations : customerAccounts;
    const [row] = await this.db
      .select({ planCode: table.planCode })
      .from(table)
      .where(
        and(
          eq(table.id, owner.id),
          owner.category === "customer" ? eq(customerAccounts.deleted, false) : undefined,
        ),
      )
      .limit(1);
    return row ? z.object({ planCode: z.string().nullable() }).parse(row).planCode : null;
  }

  async resolveAccount(subjectId: string, category: AccountCategoryCode) {
    const table = accountTables[category];
    const [row] = await this.db
      .select({ id: table.id, deleted: sql`${table.deleted}` })
      .from(table)
      .where(eq(table.subjectId, subjectId))
      .orderBy(asc(table.deleted), desc(table.id))
      .limit(1);
    return row ? z.object({ id: z.string(), deleted: flag }).parse(row) : null;
  }

  async isRegistered(userId: string, category: AccountCategoryCode) {
    const table = accountTables[category];
    const [row] = await this.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, userId), eq(table.deleted, false)))
      .limit(1);
    return !!row;
  }

  private async ordinaryUserGrant(userId: string, scope: string) {
    const [row] = await this.db
      .select({ planCode: customerAccounts.planCode })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.id, userId),
          eq(customerAccounts.deleted, false),
          exists(
            this.db
              .select({ id: organizations.id })
              .from(organizations)
              .where(and(eq(organizations.id, scope), eq(organizations.active, true))),
          ),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }

    const account = z.object({ planCode: z.string().nullable() }).parse(row);
    return {
      active: true,
      protectedRole: false,
      category: "customer" as const,
      planCode: account.planCode,
      rolePermissions: [],
    };
  }

  async grantFacts(userId: string, scope: string) {
    if (scope !== PLATFORM_SCOPE) {
      const ordinary = await this.ordinaryUserGrant(userId, scope);
      if (ordinary) {
        return ordinary;
      }
    }

    const rows = await grantRows(this.db, userId, scope);
    if (!rows.length) {
      return null;
    }

    const values = z
      .array(
        z.object({
          protected_role: flag,
          permissions_id: z.string().nullable(),
          category: z.enum(categories),
          plan_code: z.string().nullable(),
        }),
      )
      .parse(rows);
    const owner = values[0]!;
    return {
      active: true,
      protectedRole: values.some((r) => r.protected_role),
      category: owner.category,
      planCode: owner.plan_code,
      rolePermissions: values.flatMap((r) =>
        r.permissions_id === null ? [] : [PermissionValue.create(r.permissions_id)],
      ),
    };
  }

  async invitationIsCurrent(invitationId: string, subjectId: string, scope: string) {
    const issued = alias(auditEntries, "issued");
    const revoked = alias(auditEntries, "revoked");
    const a = accessAccounts(this.db);
    const [row] = await this.db
      .select({ id: issued.id })
      .from(invitations)
      .innerJoin(
        issued,
        and(
          eq(issued.action, "member.invite"),
          eq(issued.targetId, invitations.id),
          eq(issued.scope, invitations.scope),
        ),
      )
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.scope, scope),
          isNotNull(invitations.actorKind),
          notExists(
            this.db
              .select({ id: revoked.id })
              .from(revoked)
              .innerJoin(a, eq(a.id, revoked.targetId))
              .where(
                and(
                  eq(a.subject_id, subjectId),
                  eq(accountCategoryColumn, invitations.actorKind),
                  or(
                    and(eq(revoked.action, "member.remove"), eq(revoked.scope, issued.scope)),
                    inArray(revoked.action, ["user.delete", "account.delete", "account.withdraw"]),
                  ),
                  gte(revoked.occurredAt, issued.occurredAt),
                ),
              ),
          ),
        ),
      )
      .limit(1);
    return !!row;
  }

  async hasQualifiedOwner(scope: string, excludingMembershipId: string) {
    const m = accessMemberships(this.db);
    const a = accessAccounts(this.db);
    const category = scope === PLATFORM_SCOPE ? "operator" : "business";
    const [row] = await this.db
      .select({ id: m.id })
      .from(m)
      .innerJoin(
        a,
        and(
          eq(a.id, m.accounts_id),
          eq(accountCategoryColumn, membershipCategoryColumn),
          eq(accountDeletedColumn, 0),
        ),
      )
      .innerJoin(
        accessRoles,
        and(
          eq(accessRoles.id, m.access_roles_id),
          eq(accessRoles.scope, m.scope),
          eq(accessRoles.protectedRole, true),
        ),
      )
      .where(
        and(
          eq(m.scope, scope),
          ne(m.id, excludingMembershipId),
          eq(membershipCategoryColumn, category),
        ),
      )
      .limit(1);
    return !!row;
  }

  async qualified(userId: string, scope: string, category: AccountCategoryCode) {
    if (category === "customer" || (category === "operator") !== (scope === PLATFORM_SCOPE)) {
      return false;
    }

    const m = accessMemberships(this.db);
    const a = accessAccounts(this.db);
    const [row] = await this.db
      .select({ id: m.id })
      .from(m)
      .innerJoin(
        a,
        and(eq(a.id, m.accounts_id), eq(accountCategoryColumn, membershipCategoryColumn)),
      )
      .innerJoin(
        accessRoles,
        and(eq(accessRoles.id, m.access_roles_id), eq(accessRoles.scope, m.scope)),
      )
      .leftJoin(organizations, eq(organizations.id, m.scope))
      .where(
        and(
          eq(m.accounts_id, userId),
          eq(m.scope, scope),
          eq(membershipCategoryColumn, category),
          eq(accountDeletedColumn, 0),
          or(eq(m.scope, PLATFORM_SCOPE), eq(organizations.active, true)),
        ),
      )
      .limit(1);
    return !!row;
  }

  async organizations(userId: string, category: AccountCategoryCode) {
    if (category === "customer") {
      return [];
    }

    const m = accessMemberships(this.db);
    const a = accessAccounts(this.db);
    const rows = await this.db
      .select({ id: organizations.id, name: organizations.name, roleName: accessRoles.name })
      .from(m)
      .innerJoin(
        a,
        and(eq(a.id, m.accounts_id), eq(accountCategoryColumn, membershipCategoryColumn)),
      )
      .innerJoin(organizations, eq(organizations.id, m.scope))
      .innerJoin(
        accessRoles,
        and(eq(accessRoles.id, m.access_roles_id), eq(accessRoles.scope, m.scope)),
      )
      .where(
        and(
          eq(m.accounts_id, userId),
          eq(membershipCategoryColumn, category),
          eq(accountDeletedColumn, 0),
          eq(organizations.active, true),
        ),
      )
      .orderBy(asc(organizations.name), asc(organizations.id));
    return z
      .array(z.object({ id: z.string(), name: z.string(), roleName: z.string() }))
      .parse(rows);
  }

  async audit(scope: string) {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(scope === PLATFORM_SCOPE ? undefined : eq(auditEntries.scope, scope))
      .orderBy(desc(auditEntries.occurredAt), desc(auditEntries.id))
      .limit(AUDIT_PAGE_SIZE);
    return z
      .array(
        z.object({
          id: z.string(),
          actorId: z.string(),
          scope: z.string(),
          action: z.string(),
          targetId: z.string(),
          occurredAt: z.string(),
        }),
      )
      .parse(rows);
  }
}
