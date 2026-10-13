import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import { findPlanDefinition } from "#api/application/access/shared/find-plan-definition.ts";
import { conflict, deny } from "#api/application/access/shared/access-use-case-support.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { RoleEntity } from "#api/domain/access/entities/role.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { AccessRecords } from "#api/domain/access/repositories/access-repository.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import type { Permission } from "#api/domain/access/value-objects/permission.ts";

export function assertRolePermissionDelegation(
  actor: AuthorizedActor,
  scope: string,
  permissions: readonly Permission[],
) {
  const allowed = scope === PLATFORM_SCOPE ? PLATFORM_PERMISSIONS : BUSINESS_PERMISSIONS;
  const rolePermissions = actor.rolePermissions ?? actor.permissions;
  if (
    permissions.some(
      (p) =>
        !allowed.includes(p) ||
        (!(actor.platform && scope !== PLATFORM_SCOPE) && !rolePermissions.includes(p)),
    )
  ) {
    deny();
  }
}

export async function assertRolePlanLimit(
  repository: AccessReadRepository,
  scope: string,
  existing: RoleEntity | undefined,
  permissions: readonly Permission[],
) {
  // 共有ロールは企業が所有するので、編集者の個人プランでは制限しない。
  // 格下げ後も残る上限超過権限は、定義を保持したまま削減できる。
  const reduction =
    existing && permissions.every((permission) => existing.permissions.includes(permission));
  if (scope !== PLATFORM_SCOPE && !reduction) {
    const plan = await findPlanDefinition(repository, { category: "business", id: scope });
    if (permissions.some((permission) => !plan?.permissions.includes(permission))) {
      deny();
    }
  }
}

export function assertRoleEditable(
  actor: AuthorizedActor,
  scope: string,
  state: AccessRecords,
  existing: RoleEntity | undefined,
  permissions: readonly Permission[],
) {
  if (!existing) {
    return;
  }

  const rolePermissions = actor.rolePermissions ?? actor.permissions;
  if (
    state.memberships.some((m) => m.roleId === existing.id && m.category === "customer") &&
    permissions.some((p) => !CUSTOMER_PERMISSIONS.includes(p))
  ) {
    deny();
  }

  if (existing.protectedRole) {
    conflict("オーナー・運営管理者のロールは変更できません");
  }

  if (
    !(actor.platform && scope !== PLATFORM_SCOPE) &&
    existing.permissions.some((p) => !rolePermissions.includes(p))
  ) {
    deny();
  }
}
