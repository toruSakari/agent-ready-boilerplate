import type { PlanDefinitionSnapshot } from "#api/domain/access/entities/plan-definition.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import type { PlanOwner } from "#api/domain/access/entities/plan-assignment.ts";
import { ACCESS_PLANS } from "#api/domain/access/policies/plan-catalog.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";
import { effectivePermissions } from "#api/domain/access/policies/plan-permission-policy.ts";
import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";
import type {
  AccessQuery,
  AccessQuerySource,
} from "#api/application/access/queries/access-query.ts";

/** API認可・招待・ロール編集に共通する、ドメインのプラン制約の適用窓口。 */
export class PlanAccessQuery implements AccessQuery {
  private readonly catalog: readonly PlanDefinition[];

  constructor(
    private readonly source: AccessQuerySource,
    catalog: readonly PlanDefinitionSnapshot[] = ACCESS_PLANS,
  ) {
    // 注入元による後からの書換えを切り離し、定義全体を構築時に検証する。
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

  async plan(owner: PlanOwner) {
    const code = await this.source.planCode(owner);
    const plan = this.plans(owner.category).find((candidate) => candidate.code === code);
    return { code, permissions: plan?.permissions ?? [] };
  }

  async grant(userId: string, scope: string) {
    const facts = await this.source.grantFacts(userId, scope);
    if (!facts) {
      return null;
    }

    const ceiling = {
      operator: PLATFORM_PERMISSIONS,
      customer: CUSTOMER_PERMISSIONS,
      business: BUSINESS_PERMISSIONS,
    }[facts.category];
    // 委任可能範囲はサービス上限で絞るが、プランで削らない。業務実行の権限とは分ける。
    const rolePermissions = (
      facts.category === "customer" ? CUSTOMER_PERMISSIONS : facts.rolePermissions
    ).filter((permission) => ceiling.includes(permission));
    // プランコードはロールと同じ読取結果を使い、別読取による時点のずれを持ち込まない。
    const plan =
      facts.category === "operator"
        ? null
        : (this.plans(facts.category).find((candidate) => candidate.code === facts.planCode) ??
          null);
    return {
      active: facts.active,
      protectedRole: facts.protectedRole,
      permissions: facts.active ? effectivePermissions(facts.category, rolePermissions, plan) : [],
      rolePermissions,
    };
  }

  resolveAccount(subjectId: string, category: AccountCategoryCode) {
    return this.source.resolveAccount(subjectId, category);
  }

  isRegistered(userId: string, category: AccountCategoryCode) {
    return this.source.isRegistered(userId, category);
  }

  invitationIsCurrent(invitationId: string, subjectId: string, scope: string) {
    return this.source.invitationIsCurrent(invitationId, subjectId, scope);
  }

  hasQualifiedOwner(scope: string, excludingMembershipId: string) {
    return this.source.hasQualifiedOwner(scope, excludingMembershipId);
  }

  qualified(userId: string, scope: string, category: AccountCategoryCode) {
    return this.source.qualified(userId, scope, category);
  }

  organizations(userId: string, category: AccountCategoryCode) {
    return this.source.organizations(userId, category);
  }

  audit(scope: string) {
    return this.source.audit(scope);
  }
}
