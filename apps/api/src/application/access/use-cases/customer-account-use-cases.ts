import { CustomerAccountRegistrationOutputDto } from "#api/application/access/dtos/customer-account-registration-output-dto.ts";
import { CustomerAccountRegisterOutputDto } from "#api/application/access/dtos/customer-account-register-output-dto.ts";
import { CustomerAccountWithdrawOutputDto } from "#api/application/access/dtos/customer-account-withdraw-output-dto.ts";
import { CustomerAccountRemoveByOperatorOutputDto } from "#api/application/access/dtos/customer-account-remove-by-operator-output-dto.ts";
import type { CustomerAccountRegistrationInputDto } from "#api/application/access/dtos/customer-account-registration-input-dto.ts";
import type { CustomerAccountRegisterInputDto } from "#api/application/access/dtos/customer-account-register-input-dto.ts";
import type { CustomerAccountAcceptInvitationInputDto } from "#api/application/access/dtos/customer-account-accept-invitation-input-dto.ts";
import type { CustomerAccountAcceptInvitationOutputDto } from "#api/application/access/dtos/customer-account-accept-invitation-output-dto.ts";
import type { CustomerAccountWithdrawInputDto } from "#api/application/access/dtos/customer-account-withdraw-input-dto.ts";
import type { CustomerAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/customer-account-remove-by-operator-input-dto.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import {
  accessState,
  conflict,
  deny,
  inputValues,
  notFound,
  saveAccessChange,
  verifiedSubject,
} from "#api/application/access/shared/access-use-case-support.ts";
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";

export class CustomerAccountUseCases {
  constructor(
    private readonly repository: AccessRepository,
    private readonly reader: AccessReadRepository,
  ) {}

  async registration(
    inputDto: CustomerAccountRegistrationInputDto,
  ): Promise<CustomerAccountRegistrationOutputDto> {
    const { identity } = inputDto;
    if (identity.channel !== "customer") {
      deny();
    }

    const account = await this.reader.findAccount(verifiedSubject(identity), "customer");
    return CustomerAccountRegistrationOutputDto.parse({
      registered: !!account && !account.deleted,
      category: "customer" as const,
      accountId: account && !account.deleted ? account.id : null,
    });
  }

  async register(
    inputDto: CustomerAccountRegisterInputDto,
  ): Promise<CustomerAccountRegisterOutputDto> {
    const { identity, input } = inputDto;
    if (identity.channel !== "customer") {
      deny();
    }

    if (!identity.email) {
      deny("EMAIL_VERIFICATION_REQUIRED");
    }

    const subjectId = verifiedSubject(identity);
    const state = await this.repository.load(PLATFORM_SCOPE);
    if (state.customerAccounts.some((a) => a.subjectId === subjectId && a.status === "active")) {
      conflict("通常会員はすでに登録されています");
    }

    const account = inputValues(() =>
      CustomerAccountEntity.register({
        id: CustomerAccountId.create(`customer:${crypto.randomUUID()}`),
        name: AccessName.create(input.name),
        email: EmailAddress.create(identity.email),
        subjectId,
      }),
    );
    await saveAccessChange(
      this.repository,
      { ...identity, userId: account.id },
      "customer",
      state,
      // 自己登録は会員だけを作る。企業所属や企業ロールは作成しない。
      { customerAccounts: [account] },
      "account.register",
      account.id,
    );
    return CustomerAccountRegisterOutputDto.parse({ accountId: String(account.id) });
  }

  async acceptInvitation(
    inputDto: CustomerAccountAcceptInvitationInputDto,
  ): Promise<CustomerAccountAcceptInvitationOutputDto> {
    const { _identity, _input } = inputDto;
    // 一般ユーザーは企業所属を持たず、過去に発行された企業向け招待も利用できない。
    deny();
  }

  async withdraw(
    inputDto: CustomerAccountWithdrawInputDto,
  ): Promise<CustomerAccountWithdrawOutputDto> {
    const { identity } = inputDto;
    if (identity.channel !== "customer") {
      deny();
    }

    const subjectId = verifiedSubject(identity);
    const state = await this.repository.load(PLATFORM_SCOPE);
    const account = state.customerAccounts.find(
      (a) => a.id === identity.userId && a.status === "active",
    );
    if (!account || account.status !== "active" || account.subjectId !== subjectId) {
      deny();
    }

    await saveAccessChange(
      this.repository,
      identity,
      "customer",
      state,
      { withdrawnCustomerAccount: account.withdraw() },
      "account.withdraw",
      account.id,
    );
    return CustomerAccountWithdrawOutputDto.parse({ category: "customer" as const });
  }

  /** AccessUseCasesの削除処理内で、認可に用いた同じ状態スナップショットを使う。 */
  async removeByOperator(
    inputDto: CustomerAccountRemoveByOperatorInputDto,
  ): Promise<CustomerAccountRemoveByOperatorOutputDto> {
    const { identity, accountId } = inputDto;
    const state = accessState(identity, PLATFORM_SCOPE);
    const account = state.customerAccounts.find((a) => a.id === accountId && a.status === "active");
    if (!account || account.status !== "active") {
      notFound();
    }

    await saveAccessChange(
      this.repository,
      identity,
      PLATFORM_SCOPE,
      state,
      { withdrawnCustomerAccount: account.withdraw() },
      "account.delete",
      account.id,
    );
    return CustomerAccountRemoveByOperatorOutputDto.parse({ ok: true });
  }
}
