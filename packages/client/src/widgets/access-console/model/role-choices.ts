import { roleSupportsService } from "#client/entities/access";
import type { AccessRole, ServiceCategory } from "#client/entities/access";

/** 認可済みの一覧を画面の選択肢へ変換する。取得拒否後のundefinedから候補を復活させない。 */
export function scopeRoleChoices(
  roles: readonly AccessRole[] | undefined,
  category: ServiceCategory,
) {
  return {
    invitationOptions: (roles ?? [])
      .filter((role) => roleSupportsService(role, category))
      .map((role) => ({ value: role.id, label: role.name })),
    editableRoles: (roles ?? []).filter((role) => !role.protectedRole),
  };
}
