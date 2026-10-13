import { AccessInvitationInviteOutputDto } from "#api/application/access/dtos/access-invitation-invite-output-dto.ts";
import type { AccessInvitationInviteInputDto } from "#api/application/access/dtos/access-invitation-invite-input-dto.ts";
import { canManageMemberService } from "#api/application/access/policies/member-service-boundary.ts";
import {
  accessState,
  assertAssignableRole,
  assertCustomerRole,
  deny,
  inputValues,
  notFound,
  saveAccessChange,
} from "#api/application/access/shared/access-use-case-support.ts";
import { hashInvitation } from "#api/application/access/shared/invitation-token.ts";
import { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import { categoryMatchesScope } from "#api/domain/access/policies/account-categories.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AccountCategoryValue } from "#api/domain/access/value-objects/account-category.ts";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_TOKEN_BYTES = 32;

function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(INVITATION_TOKEN_BYTES)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}

export class AccessInvitationUseCases {
  constructor(private readonly repository: AccessRepository) {}

  async invite(inputDto: AccessInvitationInviteInputDto): Promise<AccessInvitationInviteOutputDto> {
    const { identity, input } = inputDto;
    const command = { ...input };
    // 公開契約のactorKindは招待先サービスを指し、実行者のサービスや権限を決めない。
    const actorKind = inputValues(() => AccountCategoryValue.create(command.actorKind));
    if (
      !categoryMatchesScope(actorKind, command.scope) ||
      !canManageMemberService(identity, actorKind)
    ) {
      deny();
    }

    const state = accessState(identity, command.scope);
    const actor = identity;
    assertOrganizationInvitations(state, command.scope, actor.platform);

    const invitedRole = assertAssignableRole(state, command.scope, command.roleId, actor);
    if (actorKind === "customer") {
      assertCustomerRole(invitedRole);
    }

    const email = inputValues(() => EmailAddress.create(command.email));
    // メールは招待の宛先であり、本人の検索やサービス間の会員結合には使わない。
    const token = newToken();
    const invitation = new InvitationEntity(
      AccessId.create(crypto.randomUUID()),
      AccessId.create(command.scope),
      email,
      AccessId.create(command.roleId),
      await hashInvitation(token),
      new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
      AccessId.create(identity.userId),
      actorKind,
      actor.platform ? "admin" : "business",
    );
    await saveAccessChange(
      this.repository,
      identity,
      command.scope,
      state,
      { invitations: [invitation] },
      "member.invite",
      invitation.id,
    );
    // 生トークンは発行結果だけに返し、保存する招待には照合用ハッシュだけを残す。
    return AccessInvitationInviteOutputDto.parse({
      token,
      expiresAt: invitation.expiresAt,
      scope: String(invitation.scope),
      actorKind: AccountCategoryValue.toCode(actorKind),
    });
  }
}

function assertOrganizationInvitations(
  state: ReturnType<typeof accessState>,
  scope: string,
  platform: boolean,
) {
  if (scope === PLATFORM_SCOPE) {
    return;
  }

  const organization = state.organizations.find((item) => item.id === scope);
  if (!organization) {
    notFound();
  }

  if (!organization.active || (!platform && !organization.invitationsEnabled)) {
    deny();
  }
}
