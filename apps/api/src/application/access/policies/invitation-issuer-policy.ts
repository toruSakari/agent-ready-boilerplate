import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import {
  BUSINESS_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { effectivePermissions } from "#api/domain/access/policies/plan-permission-policy.ts";
import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";

/** 招待発行者の会員・所属・ロール・プランEntityから現在の委任権限を判断する。 */
export class InvitationIssuerPolicy {
  constructor(private readonly repository: AccessReadRepository) {}

  plans(category: PlanCategory) {
    return this.repository.plans(category);
  }

  async isRegistered(userId: string, category: AccountCategoryCode) {
    const account = await this.repository.findAccountById(userId, category);
    return account?.status === "active";
  }

  async grant(userId: string, scope: string) {
    const context = await this.repository.grantContext(userId, scope);
    if (!context) {
      return null;
    }

    const { account, roles, organization, plan: assignment } = context;
    const active =
      account.status === "active" && (scope === PLATFORM_SCOPE || organization?.active === true);
    const ceiling = account.category === "operator" ? PLATFORM_PERMISSIONS : BUSINESS_PERMISSIONS;
    const rolePermissions = [...new Set(roles.flatMap((role) => role.permissions))].filter(
      (permission) => ceiling.includes(permission),
    );
    const plan =
      account.category === "customer" || account.category === "business"
        ? (this.plans(account.category).find((plan) => plan.code === assignment?.planCode) ?? null)
        : null;
    return {
      active,
      protectedRole: roles.some((role) => role.protectedRole),
      rolePermissions,
      permissions: active ? effectivePermissions(account.category, rolePermissions, plan) : [],
    };
  }

  async qualified(userId: string, scope: string, category: AccountCategoryCode) {
    return (await this.repository.findQualifiedMembership(userId, scope, category)) !== null;
  }
}
