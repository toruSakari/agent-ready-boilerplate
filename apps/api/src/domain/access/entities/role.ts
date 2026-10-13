import type { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import type { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import type { Permission } from "#api/domain/access/value-objects/permission.ts";

/** 権限の定義を保持する。プラン適用後の実効権限はこのロール自体へ書き戻さない。 */
export class RoleEntity {
  readonly permissions: readonly Permission[];

  constructor(
    readonly id: AccessId,
    readonly scope: AccessId,
    readonly name: AccessName,
    permissions: readonly Permission[],
    readonly protectedRole: boolean,
  ) {
    this.permissions = Object.freeze([...new Set(permissions)]);
    Object.freeze(this);
  }
}
