import type { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import type { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import type { AccountCategory } from "#api/domain/access/value-objects/account-category.ts";

export class InvitationEntity {
  constructor(
    readonly id: AccessId,
    readonly scope: AccessId,
    readonly email: EmailAddress,
    readonly roleId: AccessId,
    readonly tokenHash: string,
    readonly expiresAt: string,
    readonly inviterId: AccessId,
    // 招待先サービスと発行者のサービスは別の情報。未分類の旧招待は承諾時に拒否する。
    readonly actorKind: AccountCategory | null,
    readonly inviterChannel: "admin" | "business" | null,
  ) {
    Object.freeze(this);
  }
}
