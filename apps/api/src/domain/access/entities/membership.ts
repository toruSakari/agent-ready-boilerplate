import type { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import type { AccountCategory } from "#api/domain/access/value-objects/account-category.ts";

export class MembershipEntity {
  constructor(
    readonly id: AccessId,
    readonly scope: AccessId,
    readonly userId: AccessId,
    readonly roleId: AccessId,
    readonly category: AccountCategory,
  ) {
    Object.freeze(this);
  }
}
