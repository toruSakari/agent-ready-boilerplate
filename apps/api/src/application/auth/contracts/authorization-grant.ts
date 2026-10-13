import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";

export type AuthorizationGrant = Readonly<{
  identity: Identity;
  permissions: readonly PermissionCode[];
  /** プラン上限適用前のサーバー側ロール権限。業務操作を実行する許可には使わない。 */
  rolePermissions?: readonly PermissionCode[];
  protectedRole: boolean;
  platform: boolean;
  purpose?: ServiceActor["purpose"];
}>;
