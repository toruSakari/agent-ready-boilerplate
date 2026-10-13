import { BusinessAccountRegistrationOutputDto } from "#api/application/access/dtos/business-account-registration-output-dto.ts";
import { BusinessAccountRegisterFromInvitationOutputDto } from "#api/application/access/dtos/business-account-register-from-invitation-output-dto.ts";
import { BusinessAccountWithdrawOutputDto } from "#api/application/access/dtos/business-account-withdraw-output-dto.ts";
import { BusinessAccountRemoveByOperatorOutputDto } from "#api/application/access/dtos/business-account-remove-by-operator-output-dto.ts";
import type { BusinessAccountRegistrationInputDto } from "#api/application/access/dtos/business-account-registration-input-dto.ts";
import type { BusinessAccountRegisterFromInvitationInputDto } from "#api/application/access/dtos/business-account-register-from-invitation-input-dto.ts";
import type { BusinessAccountWithdrawInputDto } from "#api/application/access/dtos/business-account-withdraw-input-dto.ts";
import type { BusinessAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/business-account-remove-by-operator-input-dto.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import {
  accessState,
  assertBusinessOwnerRemovable,
  assertNewMembership,
  deny,
  inputValues,
  notFound,
  saveAccessChange,
  verifiedSubject,
} from "#api/application/access/shared/access-use-case-support.ts";
import { verifyInvitationAcceptance } from "#api/application/access/policies/verify-invitation-acceptance.ts";
import { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AccountCategoryValue } from "#api/domain/access/value-objects/account-category.ts";
import { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";

export class BusinessAccountUseCases {
  constructor(
    private readonly repository: AccessRepository,
    private readonly reader: AccessReadRepository,
  ) {}

  async registration(
    inputDto: BusinessAccountRegistrationInputDto,
  ): Promise<BusinessAccountRegistrationOutputDto> {
    const { identity } = inputDto;
    if (identity.channel !== "business") {
      deny();
    }

    const account = await this.reader.findAccount(verifiedSubject(identity), "business");
    return BusinessAccountRegistrationOutputDto.parse({
      registered: !!account && !account.deleted,
      category: "business" as const,
      accountId: account && !account.deleted ? account.id : null,
    });
  }

  async registerFromInvitation(
    inputDto: BusinessAccountRegisterFromInvitationInputDto,
  ): Promise<BusinessAccountRegisterFromInvitationOutputDto> {
    const { identity, input } = inputDto;
    if (identity.channel !== "business") {
      deny();
    }

    const { state, invitation, subjectId, email } = await verifyInvitationAcceptance(
      identity,
      input.token,
      this.repository,
      this.reader,
    );
    if (invitation.actorKind !== "business" || invitation.scope === PLATFORM_SCOPE) {
      deny();
    }

    // 同じsubjectでも再利用するのは対象サービスの有効会員だけ。退会・停止後は新しいIDになる。
    const existing = state.businessAccounts.find(
      (a) => a.subjectId === subjectId && a.status === "active",
    );
    const account =
      existing?.status === "active"
        ? existing
        : registerBusinessAccount(input.name, email, subjectId);
    assertNewMembership(state, "business", invitation.scope, account.id);
    const member = new MembershipEntity(
      AccessId.create(`business:${crypto.randomUUID()}`),
      invitation.scope,
      account.id,
      invitation.roleId,
      AccountCategoryValue.create("business"),
    );
    await saveAccessChange(
      this.repository,
      { ...identity, userId: account.id },
      invitation.scope,
      state,
      {
        // 登録・所属・招待消費を同じ変更へ含め、承諾の一部だけが保存されることを防ぐ。
        businessAccounts: [account],
        memberships: [member],
        removeInvitationIds: [invitation.id],
      },
      "invitation.accept",
      account.id,
    );
    return BusinessAccountRegisterFromInvitationOutputDto.parse(invitation);
  }

  async withdraw(
    inputDto: BusinessAccountWithdrawInputDto,
  ): Promise<BusinessAccountWithdrawOutputDto> {
    const { identity } = inputDto;
    if (identity.channel !== "business") {
      deny();
    }

    const subjectId = verifiedSubject(identity);
    const state = await this.repository.load(PLATFORM_SCOPE);
    const account = state.businessAccounts.find(
      (a) => a.id === identity.userId && a.status === "active",
    );
    if (!account || account.status !== "active" || account.subjectId !== subjectId) {
      deny();
    }

    // 選択中の企業だけでなく全所属を確認し、停止中の企業にも最後のオーナーを残す。
    for (const member of state.memberships.filter(
      (m) => m.category === "business" && m.userId === account.id,
    )) {
      await assertBusinessOwnerRemovable(state, member, this.reader);
    }

    await saveAccessChange(
      this.repository,
      identity,
      "business",
      state,
      { withdrawnBusinessAccount: account.withdraw() },
      "account.withdraw",
      account.id,
    );
    return BusinessAccountWithdrawOutputDto.parse({ category: "business" as const });
  }

  /** AccessUseCasesの削除処理内で、認可に用いた同じ状態スナップショットを使う。 */
  async removeByOperator(
    inputDto: BusinessAccountRemoveByOperatorInputDto,
  ): Promise<BusinessAccountRemoveByOperatorOutputDto> {
    const { identity, accountId } = inputDto;
    const state = accessState(identity, PLATFORM_SCOPE);
    const account = state.businessAccounts.find((a) => a.id === accountId && a.status === "active");
    if (!account || account.status !== "active") {
      notFound();
    }

    for (const member of state.memberships.filter(
      (m) => m.category === "business" && m.userId === account.id,
    )) {
      await assertBusinessOwnerRemovable(state, member, this.reader);
    }

    await saveAccessChange(
      this.repository,
      identity,
      PLATFORM_SCOPE,
      state,
      { withdrawnBusinessAccount: account.withdraw() },
      "account.delete",
      account.id,
    );
    return BusinessAccountRemoveByOperatorOutputDto.parse({ ok: true });
  }
}

function registerBusinessAccount(
  name: string,
  email: Parameters<typeof BusinessAccountEntity.register>[0]["email"],
  subjectId: Parameters<typeof BusinessAccountEntity.register>[0]["subjectId"],
) {
  return inputValues(() =>
    BusinessAccountEntity.register({
      id: BusinessAccountId.create(`business:${crypto.randomUUID()}`),
      name: AccessName.create(name),
      email,
      subjectId,
    }),
  );
}
