import { SERVICE_CATEGORY_LABELS } from "@dev-template/client/entities/access";
import type { AccessUser } from "#admin/entities/directory/index.ts";

/** 個人情報の権限が失効したら、メールを検索条件からも除く。 */
export function matchesUserSearch(user: AccessUser, search: string, canReadPersonal: boolean) {
  const memberships = user.memberships
    .map((member) => `${member.organizationName} ${member.roleName}`)
    .join(" ");
  return `${user.name} ${canReadPersonal ? (user.email ?? "") : ""} ${SERVICE_CATEGORY_LABELS[user.category]} ${memberships}`.includes(
    search,
  );
}
