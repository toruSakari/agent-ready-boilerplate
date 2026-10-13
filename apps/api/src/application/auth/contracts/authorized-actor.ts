import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import type { AccessRecords } from "#api/domain/access/repositories/access-repository.ts";

export type AuthorizedAccessSnapshot = Readonly<{ scope: string; state: AccessRecords }>;

/** 通信境界で確認した一操作分の値。UseCaseへフレームワーク非依存のactorデータを渡す。 */
export type AuthorizedActor = Identity &
  Readonly<{
    service: AccountCategoryCode;
    rolePermissions: readonly PermissionCode[];
    protectedRole: boolean;
    platform: boolean;
    purpose?: ServiceActor["purpose"];
    accessSnapshot?: AuthorizedAccessSnapshot;
  }>;
