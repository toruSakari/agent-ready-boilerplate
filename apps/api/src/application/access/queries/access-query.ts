import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type { PlanOwner } from "#api/domain/access/entities/plan-assignment.ts";
import type { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";
import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";

export type AccessGrant = {
  active: boolean;
  permissions: readonly PermissionCode[];
  protectedRole: boolean;
  /** 委任可能範囲を調べるサーバー側ロール権限。実行にはプラン適用済みのpermissionsを使う。 */
  rolePermissions?: readonly PermissionCode[];
};

/** 会員・所属の現在状態と、ドメインのプラン制約を適用済みの権限を提供する。 */
export interface AccessQuery {
  plans(category: PlanCategory): readonly PlanDefinition[];
  plan(owner: PlanOwner): Promise<{ code: string | null; permissions: readonly PermissionCode[] }>;
  resolveAccount(
    subjectId: string,
    category: AccountCategoryCode,
  ): Promise<{ id: string; deleted: boolean } | null>;
  isRegistered(userId: string, category: AccountCategoryCode): Promise<boolean>;
  grant(userId: string, scope: string): Promise<AccessGrant | null>;
  invitationIsCurrent(invitationId: string, subjectId: string, scope: string): Promise<boolean>;
  hasQualifiedOwner(scope: string, excludingMembershipId: string): Promise<boolean>;
  qualified(userId: string, scope: string, actorKind: AccountCategoryCode): Promise<boolean>;
  organizations(
    userId: string,
    actorKind: AccountCategoryCode,
  ): Promise<{ id: string; name: string; roleName: string }[]>;
  audit(scope: string): Promise<
    {
      id: string;
      actorId: string;
      scope: string;
      action: string;
      targetId: string;
      occurredAt: string;
    }[]
  >;
}

/** 同じ読取結果に含まれる現在の保存事実。プランの解決と権限計算はapplication側で行う。 */
export type AccessGrantFacts = Readonly<{
  active: boolean;
  protectedRole: boolean;
  category: AccountCategoryCode;
  planCode: string | null;
  rolePermissions: readonly PermissionCode[];
}>;

/** 永続化アダプターの読取契約。プランカタログや実効権限の判断を持ち込まない。 */
export interface AccessQuerySource extends Omit<AccessQuery, "plans" | "plan" | "grant"> {
  planCode(owner: PlanOwner): Promise<string | null>;
  grantFacts(userId: string, scope: string): Promise<AccessGrantFacts | null>;
}
