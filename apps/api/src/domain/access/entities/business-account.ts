import { InvalidBusinessAccountError } from "#api/domain/access/errors/invalid-business-account-error.ts";
import { InvalidBusinessAccountTransitionError } from "#api/domain/access/errors/invalid-business-account-transition-error.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import type { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import type { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import type { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";

export type BusinessAccountStatus = "active" | "withdrawn";

type BusinessAccountData<S extends BusinessAccountStatus> = Readonly<{
  id: BusinessAccountId;
  name: AccessName;
  email: EmailAddress | null;
  subjectId: AuthenticationSubjectId;
  status: S;
}>;

export type BusinessAccountRestoration = BusinessAccountData<BusinessAccountStatus>;

export type BusinessAccount = {
  [S in BusinessAccountStatus]: BusinessAccountEntity<S>;
}[BusinessAccountStatus];

const WITHDRAWN_BUSINESS_ACCOUNT_NAME = AccessName.create("削除済みユーザー");

/** 企業担当者のライフサイクルを所有し、同じ本人の別サービス会員へ状態変更を波及させない。 */
export class BusinessAccountEntity<S extends BusinessAccountStatus> {
  // 実行時の値を増やさず、異なる状態のインスタンスを型で区別する。
  declare private readonly stateBrand: S;
  readonly category = "business" as const;
  readonly id: BusinessAccountId;
  readonly name: AccessName;
  readonly email: EmailAddress | null;
  readonly subjectId: AuthenticationSubjectId;
  readonly status: S;

  private constructor(data: BusinessAccountData<S>) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.subjectId = data.subjectId;
    this.status = data.status;
    Object.freeze(this);
  }

  static register(
    input: Omit<BusinessAccountData<"active">, "status" | "email"> & { email: EmailAddress },
  ): BusinessAccountEntity<"active"> {
    if (input.email === null) {
      throw new InvalidBusinessAccountError("企業担当者の登録にはメールアドレスが必要です");
    }

    return new BusinessAccountEntity({ ...input, status: "active" });
  }

  static restore(value: BusinessAccountRestoration): BusinessAccount {
    // 登録・匿名化ルール導入前の履歴も復元するため、保存済みの名前や連絡先を変更しない。
    switch (value.status) {
      case "active":
        return new BusinessAccountEntity({ ...value, status: "active" });
      case "withdrawn":
        return new BusinessAccountEntity({ ...value, status: "withdrawn" });
      default:
        throw new InvalidBusinessAccountError("企業担当者の状態が不正です");
    }
  }

  get deleted(): boolean {
    return this.status === "withdrawn";
  }

  withdraw(this: BusinessAccountEntity<"active">): BusinessAccountEntity<"withdrawn"> {
    if (this.status !== "active") {
      throw new InvalidBusinessAccountTransitionError("有効な企業担当者だけが退会できます");
    }

    // 注文・監査と失効判定に使うIDは残し、名前と連絡先を匿名化した新しい状態を返す。
    return new BusinessAccountEntity({
      id: this.id,
      name: WITHDRAWN_BUSINESS_ACCOUNT_NAME,
      email: null,
      subjectId: this.subjectId,
      status: "withdrawn",
    });
  }
}
