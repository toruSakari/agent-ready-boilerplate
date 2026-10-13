import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";

/** 企業のメンバー管理は企業担当者に限定し、一般会員の管理は運営へ分離する。 */
export function canManageMemberService(
  actor: { platform: boolean; channel?: string },
  category: AccountCategoryCode,
) {
  if (category === "customer") {
    return false;
  }

  return (
    (actor.platform && actor.channel === "admin") ||
    (actor.channel === "business" && category === "business")
  );
}
