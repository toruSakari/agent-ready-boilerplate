import { InvalidOperatorAccountError } from "#api/domain/access/errors/invalid-operator-account-error.ts";
import { InvalidOperatorAccountTransitionError } from "#api/domain/access/errors/invalid-operator-account-transition-error.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import type { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import type { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import type { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";

export type OperatorAccountStatus = "active" | "stopped";

type OperatorAccountData<S extends OperatorAccountStatus> = Readonly<{
  id: OperatorAccountId;
  name: AccessName;
  email: EmailAddress | null;
  subjectId: AuthenticationSubjectId;
  status: S;
}>;

export type OperatorAccountRestoration = OperatorAccountData<OperatorAccountStatus>;

export type OperatorAccount = {
  [S in OperatorAccountStatus]: OperatorAccountEntity<S>;
}[OperatorAccountStatus];

const STOPPED_OPERATOR_NAME = AccessName.create("削除済みユーザー");

/** 運営担当者のライフサイクルを所有し、同じ本人の別サービス会員へ状態変更を波及させない。 */
export class OperatorAccountEntity<S extends OperatorAccountStatus> {
  // 実行時の値を増やさず、異なる状態のインスタンスを型で区別する。
  declare private readonly stateBrand: S;
  readonly category = "operator" as const;
  readonly id: OperatorAccountId;
  readonly name: AccessName;
  readonly email: EmailAddress | null;
  readonly subjectId: AuthenticationSubjectId;
  readonly status: S;

  private constructor(data: OperatorAccountData<S>) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.subjectId = data.subjectId;
    this.status = data.status;
    Object.freeze(this);
  }

  static register(
    input: Omit<OperatorAccountData<"active">, "status" | "email"> & { email: EmailAddress },
  ): OperatorAccountEntity<"active"> {
    if (input.email === null) {
      throw new InvalidOperatorAccountError("運営アカウントの登録にはメールアドレスが必要です");
    }

    return new OperatorAccountEntity({ ...input, status: "active" });
  }

  static restore(value: OperatorAccountRestoration): OperatorAccount {
    // 登録・匿名化ルール導入前の履歴も復元するため、保存済みの名前や連絡先を変更しない。
    switch (value.status) {
      case "active":
        return new OperatorAccountEntity({ ...value, status: "active" });
      case "stopped":
        return new OperatorAccountEntity({ ...value, status: "stopped" });
      default:
        throw new InvalidOperatorAccountError("運営アカウントの状態が不正です");
    }
  }

  get deleted(): boolean {
    return this.status === "stopped";
  }

  stop(this: OperatorAccountEntity<"active">): OperatorAccountEntity<"stopped"> {
    if (this.status !== "active") {
      throw new InvalidOperatorAccountTransitionError("有効な運営アカウントだけを停止できます");
    }

    // 注文・監査と失効判定に使うIDは残し、名前と連絡先を匿名化した新しい状態を返す。
    return new OperatorAccountEntity({
      id: this.id,
      name: STOPPED_OPERATOR_NAME,
      email: null,
      subjectId: this.subjectId,
      status: "stopped",
    });
  }
}
