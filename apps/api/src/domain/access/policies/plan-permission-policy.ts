import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";

export type PlanCategory = "customer" | "business";

/** ロール・サービス上限・プランの共通部分だけを返し、プランから権限を追加しない。 */
export function effectivePermissions(
  category: AccountCategoryCode,
  rolePermissions: readonly PermissionCode[],
  plan: PlanDefinition | null,
): readonly PermissionCode[] {
  // 運営は料金プラン対象外でも、運営ロールとサービス上限の制約を受ける。
  if (category === "operator") {
    return Object.freeze(
      [...new Set(rolePermissions)].filter((permission) =>
        PLATFORM_PERMISSIONS.includes(permission),
      ),
    );
  }

  // 未割当・未知・別サービスのプランは安全側へ倒し、業務権限を与えない。
  if ((category !== "customer" && category !== "business") || !plan || plan.category !== category) {
    return Object.freeze([]);
  }

  const ceiling = category === "customer" ? CUSTOMER_PERMISSIONS : BUSINESS_PERMISSIONS;
  return Object.freeze(
    [...new Set(rolePermissions)].filter(
      (permission) =>
        ceiling.includes(permission) && plan.permissions.some((value) => value === permission),
    ),
  );
}
