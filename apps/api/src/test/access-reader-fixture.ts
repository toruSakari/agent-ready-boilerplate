import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import type { AccessRecords } from "#api/domain/access/repositories/access-repository.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import { restoreStoredServiceAccount } from "#api/infrastructure/access/mappers/restore-stored-service-account.ts";
import { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import { RoleEntity } from "#api/domain/access/entities/role.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AccountCategoryValue } from "#api/domain/access/value-objects/account-category.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import { AccessAuditEntry } from "#api/domain/access/entities/access-audit-entry.ts";

function account(
  id: string,
  category: AccountCategoryCode,
  subjectId = "subject:test",
  deleted = false,
) {
  return restoreStoredServiceAccount({
    id,
    category,
    subject_id: subjectId,
    name: "会員",
    email: "test@example.com",
    deleted: Number(deleted),
  });
}

function membership(scope: string, category: AccountCategoryCode) {
  return new MembershipEntity(
    AccessId.create("membership:other"),
    AccessId.create(scope),
    AccessId.create(category + ":other"),
    AccessId.create("role:other"),
    AccountCategoryValue.create(category),
  );
}

/** 認証境界の既存モックとは分け、UseCaseの読取ポートへ復元済みEntityを渡す。 */
export function accessReaderFixture(
  query: AccessQuery,
  state: AccessRecords,
): AccessReadRepository {
  return {
    plans: (category) => query.plans(category),
    load: async () => state,
    organizationContexts: organizationContextsFixture(query),
    findAccount: async (subjectId, category) => {
      const row = await query.resolveAccount(subjectId, category);
      return row ? account(row.id, category, subjectId, row.deleted) : null;
    },
    findAccountById: async (id, category) =>
      (await query.isRegistered(id, category)) ? account(id, category) : null,
    findPlan: async (owner) => {
      const row = await query.plan(owner);
      return new PlanAssignment(
        owner.category,
        AccessId.create(owner.id),
        row.code === null ? null : AccessId.create(row.code),
      );
    },
    findCurrentInvitation: async (id, subjectId, scope) =>
      (await query.invitationIsCurrent(id, subjectId, scope))
        ? (state.invitations.find((invitation) => invitation.id === id) ?? null)
        : null,
    findOtherProtectedMembership: async (scope, excludingId) =>
      (await query.hasQualifiedOwner(scope, excludingId))
        ? membership(scope, scope === PLATFORM_SCOPE ? "operator" : "business")
        : null,
    findQualifiedMembership: async (id, scope, category) =>
      (await query.qualified(id, scope, category)) ? membership(scope, category) : null,
    audit: async (scope) => (await query.audit(scope)).map(AccessAuditEntry.restore),
    grantContext: grantContextFixture(query),
  };
}

function grantContextFixture(query: AccessQuery): AccessReadRepository["grantContext"] {
  return async (userId: string, scope: string) => {
    const grant = await query.grant(userId, scope);
    if (!grant) {
      return null;
    }

    const category = scope === PLATFORM_SCOPE ? "operator" : "business";
    return {
      account: account(userId, category, "subject:test", !grant.active),
      roles: [
        new RoleEntity(
          AccessId.create("role:test"),
          AccessId.create(scope),
          AccessName.create("テスト"),
          (grant.rolePermissions ?? grant.permissions).map(PermissionValue.create),
          grant.protectedRole,
        ),
      ],
      organization:
        scope === PLATFORM_SCOPE
          ? null
          : new OrganizationEntity(AccessId.create(scope), AccessName.create("企業"), true, true),
      plan:
        category === "business"
          ? new PlanAssignment("business", AccessId.create(scope), AccessId.create("business:demo"))
          : null,
    };
  };
}

function organizationContextsFixture(query: AccessQuery) {
  return async (userId: string, category: AccountCategoryCode) =>
    (await query.organizations(userId, category)).map((row) => ({
      organization: new OrganizationEntity(
        AccessId.create(row.id),
        AccessName.create(row.name),
        true,
        false,
      ),
      role: new RoleEntity(
        AccessId.create("role:test"),
        AccessId.create(row.id),
        AccessName.create(row.roleName),
        [],
        false,
      ),
    }));
}
