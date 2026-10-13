import { canManageMemberService } from "#api/application/access/policies/member-service-boundary.ts";
import { InvitationIssuerPolicy } from "#api/application/access/policies/invitation-issuer-policy.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import {
  assertAssignableRole,
  conflict,
  deny,
  verifiedSubject,
} from "#api/application/access/shared/access-use-case-support.ts";
import { hashInvitation } from "#api/application/access/shared/invitation-token.ts";
import { authorizeInvitationIssuer } from "#api/application/auth/policies/authorize-access.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import type { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import { categoryMatchesScope } from "#api/domain/access/policies/account-categories.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";

/** トークン・本人・発行者の検証だけを共有し、会員の作成とサービス固有のロール制約は呼出元が担う。 */
export async function verifyInvitationAcceptance(
  identity: Identity,
  token: string,
  repository: AccessRepository,
  reader: AccessReadRepository,
) {
  const invitation = await repository.findInvitation(await hashInvitation(token));
  assertUsableInvitation(invitation);
  const subjectId = verifiedSubject(identity);
  if (!identity.email) {
    deny("EMAIL_VERIFICATION_REQUIRED");
  }

  if (EmailAddress.create(identity.email) !== invitation.email) {
    deny();
  }

  // 先に版を取得してから失効履歴を検査し、この後の所属解除も同じ版での保存競合にする。
  const state = await repository.load(PLATFORM_SCOPE);
  if (!(await reader.findCurrentInvitation(invitation.id, subjectId, invitation.scope))) {
    throw new ApplicationError({
      code: "BAD_REQUEST",
      message: "招待は所属解除・退会により無効です。新しい招待を依頼してください",
    });
  }

  const organization = state.organizations.find((o) => o.id === invitation.scope);
  assertActiveInvitationOrganization(invitation.scope, organization);
  // 発行時の許可は承諾まで保証されないため、保存された発行元サービスの現在権限を再確認する。
  const actor = await authorizeInvitationIssuer(
    {
      ...identity,
      userId: invitation.inviterId,
      tenantId: invitation.scope,
      channel: invitation.inviterChannel,
    },
    invitation.scope,
    "member.invite",
    new InvitationIssuerPolicy(reader),
  );
  if (
    !canManageMemberService(
      { platform: actor.platform, channel: invitation.inviterChannel },
      invitation.actorKind,
    )
  ) {
    deny();
  }

  assertInvitationsEnabled(invitation.scope, actor.platform, organization);
  const role = assertAssignableRole(state, invitation.scope, invitation.roleId, actor);
  if (!state.invitations.some((i) => i.id === invitation.id)) {
    conflict("招待はすでに利用されています");
  }

  return { state, invitation, role, subjectId, email: EmailAddress.create(identity.email) };
}

function assertUsableInvitation(
  invitation: InvitationEntity | null,
): asserts invitation is InvitationEntity & {
  actorKind: NonNullable<InvitationEntity["actorKind"]>;
  inviterChannel: NonNullable<InvitationEntity["inviterChannel"]>;
} {
  if (
    !invitation ||
    !invitation.actorKind ||
    !invitation.inviterChannel ||
    !categoryMatchesScope(invitation.actorKind, invitation.scope) ||
    Date.parse(invitation.expiresAt) <= Date.now()
  ) {
    throw new ApplicationError({
      code: "BAD_REQUEST",
      reason: "INVITATION_INVALID",
      message: "招待が無効か期限切れです",
    });
  }
}

function assertActiveInvitationOrganization(
  scope: string,
  organization: OrganizationEntity | undefined,
) {
  if (scope !== PLATFORM_SCOPE && !organization?.active) {
    deny();
  }
}

function assertInvitationsEnabled(
  scope: string,
  platform: boolean,
  organization: OrganizationEntity | undefined,
) {
  if (scope !== PLATFORM_SCOPE && !platform && !organization?.invitationsEnabled) {
    deny();
  }
}
