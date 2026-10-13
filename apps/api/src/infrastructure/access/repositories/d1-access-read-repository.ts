import type { PlanDefinitionSnapshot } from "#api/domain/access/entities/plan-definition.ts";
import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import { ACCESS_PLANS } from "#api/domain/access/policies/plan-catalog.ts";
import { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";
import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";
import { organizationContexts } from "#api/infrastructure/access/shared/organization-contexts.ts";
import { drizzle } from "drizzle-orm/d1";
import { and, or, eq, ne, asc, desc, notExists, gte, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  accountTables,
  accountCategoryColumn,
  accountDeletedColumn,
  membershipCategoryColumn,
  accessAccounts,
  accessMemberships,
  storedColumns,
} from "#api/infrastructure/access/shared/access-record-selections.ts";
import {
  organizations,
  customerAccounts,
  accessRoles,
  invitations,
  auditEntries,
} from "#api/infrastructure/access/schemas/schema.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import { D1AccessRepository } from "#api/infrastructure/access/repositories/d1-access-repository.ts";
import {
  restoreInvitation,
  restoreMembership,
} from "#api/infrastructure/access/mappers/restore-access-records.ts";
import { restoreStoredServiceAccount } from "#api/infrastructure/access/mappers/restore-stored-service-account.ts";
import { AccessAuditEntry } from "#api/domain/access/entities/access-audit-entry.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import type { PlanOwner } from "#api/domain/access/entities/plan-assignment.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";

export class D1AccessReadRepository implements AccessReadRepository {
  private readonly db;
  private readonly catalog: readonly PlanDefinition[];

  constructor(
    private readonly binding: D1Database,
    catalog: readonly PlanDefinitionSnapshot[] = ACCESS_PLANS,
  ) {
    this.db = drizzle(binding);
    this.catalog = Object.freeze(catalog.map((plan) => PlanDefinition.create(plan)));
    if (
      new Set(this.catalog.map((plan) => `${plan.category}:${plan.code}`)).size !==
      this.catalog.length
    ) {
      throw new Error("プランコードが重複しています");
    }
  }

  plans(category: PlanCategory) {
    return this.catalog.filter((plan) => plan.category === category);
  }

  organizationContexts(userId: string, category: AccountCategoryCode) {
    return organizationContexts(this.db, userId, category);
  }

  async grantContext(userId: string, scope: string) {
    const state = await this.load(scope);
    const account = [...state.businessAccounts, ...state.operatorAccounts].find(
      (account) => account.id === userId && account.status === "active",
    );
    if (!account) {
      return null;
    }

    const rolesById = new Map(
      state.roles.filter((role) => role.scope === scope).map((role) => [String(role.id), role]),
    );
    const roleIds = new Set(
      state.memberships
        .filter((m) => m.scope === scope && m.userId === userId && m.category === account.category)
        .map((m) => String(m.roleId)),
    );
    const roles = [...roleIds].flatMap((id) => {
      const role = rolesById.get(id);
      return role ? [role] : [];
    });
    if (!roles.length) {
      return null;
    }

    const organization = state.organizations.find((o) => o.id === scope) ?? null;
    const plan =
      account.category === "business"
        ? await this.findPlan({ category: "business", id: scope })
        : null;
    return { account, roles, organization, plan };
  }

  load(scope: string) {
    return new D1AccessRepository(this.binding).load(scope);
  }

  async findAccount(subjectId: string, category: AccountCategoryCode) {
    const table = accountTables[category];
    const [row] = await this.db
      .select(storedColumns(table))
      .from(table)
      .where(eq(table.subjectId, subjectId))
      .orderBy(asc(table.deleted), desc(table.id))
      .limit(1);
    return row ? restoreStoredServiceAccount({ ...row, category }) : null;
  }

  async findAccountById(id: string, category: AccountCategoryCode) {
    const table = accountTables[category];
    const [row] = await this.db
      .select(storedColumns(table))
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    return row ? restoreStoredServiceAccount({ ...row, category }) : null;
  }

  async findPlan(owner: PlanOwner) {
    const table = owner.category === "business" ? organizations : customerAccounts;
    const [row] = await this.db
      .select({ id: table.id, planCode: table.planCode })
      .from(table)
      .where(
        and(
          eq(table.id, owner.id),
          owner.category === "customer" ? eq(customerAccounts.deleted, false) : undefined,
        ),
      )
      .limit(1);
    return row
      ? new PlanAssignment(
          owner.category,
          AccessId.create(row.id),
          row.planCode === null ? null : AccessId.create(row.planCode),
        )
      : null;
  }

  async findCurrentInvitation(invitationId: string, subjectId: string, scope: string) {
    const issued = alias(auditEntries, "issued");
    const revoked = alias(auditEntries, "revoked");
    const a = accessAccounts(this.db);
    const [row] = await this.db
      .select(storedColumns(invitations))
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
    return row ? restoreInvitation(row) : null;
  }

  async findOtherProtectedMembership(scope: string, excludingMembershipId: string) {
    const m = accessMemberships(this.db);
    const a = accessAccounts(this.db);
    const category = scope === PLATFORM_SCOPE ? "operator" : "business";
    const [row] = await this.db
      .select({
        id: m.id,
        scope: m.scope,
        accounts_id: m.accounts_id,
        access_roles_id: m.access_roles_id,
        category: membershipCategoryColumn,
      })
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
    return row ? restoreMembership(row) : null;
  }

  async findQualifiedMembership(userId: string, scope: string, category: AccountCategoryCode) {
    if (category === "customer" || (category === "operator") !== (scope === PLATFORM_SCOPE)) {
      return null;
    }

    const m = accessMemberships(this.db);
    const a = accessAccounts(this.db);
    const [row] = await this.db
      .select({
        id: m.id,
        scope: m.scope,
        accounts_id: m.accounts_id,
        access_roles_id: m.access_roles_id,
        category: membershipCategoryColumn,
      })
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
    return row ? restoreMembership(row) : null;
  }

  async audit(scope: string) {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(scope === PLATFORM_SCOPE ? undefined : eq(auditEntries.scope, scope))
      .orderBy(desc(auditEntries.occurredAt), desc(auditEntries.id))
      .limit(100);
    return rows.map(AccessAuditEntry.restore);
  }
}
