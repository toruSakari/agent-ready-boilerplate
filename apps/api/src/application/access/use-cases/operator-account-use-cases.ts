import { OperatorAccountRegistrationOutputDto } from "#api/application/access/dtos/operator-account-registration-output-dto.ts";
import { OperatorAccountRegisterFromInvitationOutputDto } from "#api/application/access/dtos/operator-account-register-from-invitation-output-dto.ts";
import { OperatorAccountStopOutputDto } from "#api/application/access/dtos/operator-account-stop-output-dto.ts";
import { OperatorAccountRemoveByOperatorOutputDto } from "#api/application/access/dtos/operator-account-remove-by-operator-output-dto.ts";
import type { OperatorAccountRegistrationInputDto } from "#api/application/access/dtos/operator-account-registration-input-dto.ts";
import type { OperatorAccountRegisterFromInvitationInputDto } from "#api/application/access/dtos/operator-account-register-from-invitation-input-dto.ts";
import type { OperatorAccountStopInputDto } from "#api/application/access/dtos/operator-account-stop-input-dto.ts";
import type { OperatorAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/operator-account-remove-by-operator-input-dto.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import {
  accessState,
  assertAssignableRole,
  assertNewMembership,
  assertOperatorAdministratorRemovable,
  deny,
  inputValues,
  notFound,
  saveAccessChange,
  verifiedSubject,
} from "#api/application/access/shared/access-use-case-support.ts";
import { verifyInvitationAcceptance } from "#api/application/access/policies/verify-invitation-acceptance.ts";
import { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AccountCategoryValue } from "#api/domain/access/value-objects/account-category.ts";
import { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";

export class OperatorAccountUseCases {
  constructor(
    private readonly repository: AccessRepository,
    private readonly reader: AccessReadRepository,
  ) {}

  async registration(
    inputDto: OperatorAccountRegistrationInputDto,
  ): Promise<OperatorAccountRegistrationOutputDto> {
    const { identity } = inputDto;
    if (identity.channel !== "admin") {
      deny();
    }

    const account = await this.reader.findAccount(verifiedSubject(identity), "operator");
    return OperatorAccountRegistrationOutputDto.parse({
      registered: !!account && !account.deleted,
      category: "operator" as const,
      accountId: account && !account.deleted ? account.id : null,
    });
  }

  async registerFromInvitation(
    inputDto: OperatorAccountRegisterFromInvitationInputDto,
  ): Promise<OperatorAccountRegisterFromInvitationOutputDto> {
    const { identity, input } = inputDto;
    if (identity.channel !== "admin") {
      deny();
    }

    const { state, invitation, subjectId, email } = await verifyInvitationAcceptance(
      identity,
      input.token,
      this.repository,
      this.reader,
    );
    if (invitation.actorKind !== "operator" || invitation.scope !== PLATFORM_SCOPE) {
      deny();
    }

    // 同じsubjectでも再利用するのは対象サービスの有効会員だけ。退会・停止後は新しいIDになる。
    const existing = state.operatorAccounts.find(
      (a) => a.subjectId === subjectId && a.status === "active",
    );
    const account =
      existing?.status === "active"
        ? existing
        : registerOperatorAccount(input.name, email, subjectId);
    assertNewMembership(state, "operator", invitation.scope, account.id);
    const member = new MembershipEntity(
      AccessId.create(`operator:${crypto.randomUUID()}`),
      invitation.scope,
      account.id,
      invitation.roleId,
      AccountCategoryValue.create("operator"),
    );
    await saveAccessChange(
      this.repository,
      { ...identity, userId: account.id },
      invitation.scope,
      state,
      {
        // 登録・所属・招待消費を同じ変更へ含め、承諾の一部だけが保存されることを防ぐ。
        operatorAccounts: [account],
        memberships: [member],
        removeInvitationIds: [invitation.id],
      },
      "invitation.accept",
      account.id,
    );
    return OperatorAccountRegisterFromInvitationOutputDto.parse(invitation);
  }

  async stop(inputDto: OperatorAccountStopInputDto): Promise<OperatorAccountStopOutputDto> {
    const { identity } = inputDto;
    if (identity.channel !== "admin") {
      deny();
    }

    const subjectId = verifiedSubject(identity);
    const state = await this.repository.load(PLATFORM_SCOPE);
    const account = state.operatorAccounts.find(
      (a) => a.id === identity.userId && a.status === "active",
    );
    if (!account || account.status !== "active" || account.subjectId !== subjectId) {
      deny();
    }

    for (const member of state.memberships.filter(
      (m) => m.category === "operator" && m.userId === account.id,
    )) {
      await assertOperatorAdministratorRemovable(state, member, this.reader);
    }

    await saveAccessChange(
      this.repository,
      identity,
      "operator",
      state,
      { stoppedOperatorAccount: account.stop() },
      "account.withdraw",
      account.id,
    );
    return OperatorAccountStopOutputDto.parse({ category: "operator" as const });
  }

  /** AccessUseCasesの削除処理内で、認可に用いた同じ状態スナップショットを使う。 */
  async removeByOperator(
    inputDto: OperatorAccountRemoveByOperatorInputDto,
  ): Promise<OperatorAccountRemoveByOperatorOutputDto> {
    const { identity, accountId } = inputDto;
    const state = accessState(identity, PLATFORM_SCOPE);
    const actor = identity;
    const account = state.operatorAccounts.find((a) => a.id === accountId && a.status === "active");
    if (!account || account.status !== "active") {
      notFound();
    }

    for (const member of state.memberships.filter(
      (m) => m.category === "operator" && m.userId === account.id,
    )) {
      // 運営からの削除でも、削除者が委任できない強いロールの担当者は対象にしない。
      assertAssignableRole(state, PLATFORM_SCOPE, member.roleId, actor);
      await assertOperatorAdministratorRemovable(state, member, this.reader);
    }

    await saveAccessChange(
      this.repository,
      identity,
      PLATFORM_SCOPE,
      state,
      { stoppedOperatorAccount: account.stop() },
      "account.delete",
      account.id,
    );
    return OperatorAccountRemoveByOperatorOutputDto.parse({ ok: true });
  }
}

function registerOperatorAccount(
  name: string,
  email: Parameters<typeof OperatorAccountEntity.register>[0]["email"],
  subjectId: Parameters<typeof OperatorAccountEntity.register>[0]["subjectId"],
) {
  return inputValues(() =>
    OperatorAccountEntity.register({
      id: OperatorAccountId.create(`operator:${crypto.randomUUID()}`),
      name: AccessName.create(name),
      email,
      subjectId,
    }),
  );
}
