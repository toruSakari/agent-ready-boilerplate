import { InvalidCustomerAccountError } from "#api/domain/access/errors/invalid-customer-account-error.ts";
import { InvalidCustomerAccountTransitionError } from "#api/domain/access/errors/invalid-customer-account-transition-error.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import type { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import type { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import type { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";

export type CustomerAccountStatus = "active" | "withdrawn";

type CustomerAccountData<S extends CustomerAccountStatus> = Readonly<{
  id: CustomerAccountId;
  name: AccessName;
  email: EmailAddress | null;
  subjectId: AuthenticationSubjectId;
  status: S;
}>;

export type CustomerAccountRestoration = CustomerAccountData<CustomerAccountStatus>;

export type CustomerAccount = {
  [S in CustomerAccountStatus]: CustomerAccountEntity<S>;
}[CustomerAccountStatus];

const WITHDRAWN_CUSTOMER_NAME = AccessName.create("削除済みユーザー");

/** 通常会員のライフサイクルを所有し、同じ本人の別サービス会員へ状態変更を波及させない。 */
export class CustomerAccountEntity<S extends CustomerAccountStatus> {
  // 実行時の値を増やさず、異なる状態のインスタンスを型で区別する。
  declare private readonly stateBrand: S;
  readonly category = "customer" as const;
  readonly id: CustomerAccountId;
  readonly name: AccessName;
  readonly email: EmailAddress | null;
  readonly subjectId: AuthenticationSubjectId;
  readonly status: S;

  private constructor(data: CustomerAccountData<S>) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.subjectId = data.subjectId;
    this.status = data.status;
    Object.freeze(this);
  }

  static register(
    input: Omit<CustomerAccountData<"active">, "status" | "email"> & { email: EmailAddress },
  ): CustomerAccountEntity<"active"> {
    if (input.email === null) {
      throw new InvalidCustomerAccountError("通常会員の登録にはメールアドレスが必要です");
    }

    return new CustomerAccountEntity({ ...input, status: "active" });
  }

  static restore(value: CustomerAccountRestoration): CustomerAccount {
    // 登録・匿名化ルール導入前の履歴も復元するため、保存済みの名前や連絡先を変更しない。
    switch (value.status) {
      case "active":
        return new CustomerAccountEntity({ ...value, status: "active" });
      case "withdrawn":
        return new CustomerAccountEntity({ ...value, status: "withdrawn" });
      default:
        throw new InvalidCustomerAccountError("通常会員の状態が不正です");
    }
  }

  get deleted(): boolean {
    return this.status === "withdrawn";
  }

  withdraw(this: CustomerAccountEntity<"active">): CustomerAccountEntity<"withdrawn"> {
    if (this.status !== "active") {
      throw new InvalidCustomerAccountTransitionError("有効な通常会員だけが退会できます");
    }

    // 注文・監査と失効判定に使うIDは残し、名前と連絡先を匿名化した新しい状態を返す。
    return new CustomerAccountEntity({
      id: this.id,
      name: WITHDRAWN_CUSTOMER_NAME,
      email: null,
      subjectId: this.subjectId,
      status: "withdrawn",
    });
  }
}
