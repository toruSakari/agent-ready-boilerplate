import { InvalidPaymentError } from "#api/domain/payment/errors/invalid-payment-error.ts";
import { InvalidPaymentTransitionError } from "#api/domain/payment/errors/invalid-payment-transition-error.ts";
import { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";
import { isNonEmptyString, isTimestamp } from "#api/domain/shared/validation.ts";

export type PaymentStatus = "pending" | "authorized" | "captured" | "failed" | "voided";

export type PaymentSnapshot<S extends PaymentStatus = PaymentStatus> = Readonly<{
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: S;
  authorizationId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}>;

type PaymentData<S extends PaymentStatus = PaymentStatus> = Omit<
  PaymentSnapshot<S>,
  "amount" | "currency"
> & { amount: PaymentAmount; currency: CurrencyCode };

type PaymentEvent<TName extends string, TPayload> = Readonly<{
  id: string;
  name: TName;
  aggregateId: string;
  occurredAt: string;
  payload: TPayload;
}>;

export type PaymentInitiated = PaymentEvent<
  "payment.initiated",
  Readonly<{ orderId: string; amount: number; currency: string }>
>;

export type PaymentAuthorized = PaymentEvent<
  "payment.authorized",
  Readonly<{ authorizationId: string }>
>;

export type PaymentCaptured = PaymentEvent<"payment.captured", Readonly<{ amount: number }>>;

export type PaymentFailed = PaymentEvent<"payment.failed", Readonly<{ reason: string }>>;

export type PaymentVoided = PaymentEvent<"payment.voided", Readonly<{ orderId: string }>>;

export type PaymentDomainEvent =
  | PaymentInitiated
  | PaymentAuthorized
  | PaymentCaptured
  | PaymentFailed
  | PaymentVoided;

export type PaymentRestoration = Readonly<PaymentData>;

export type Payment = { [S in PaymentStatus]: PaymentEntity<S> }[PaymentStatus];

// 承認ID・失敗理由と状態の関係は集約が検証し、保存値の形式検証はアダプターに任せる。
function validateRestoration(value: PaymentRestoration): PaymentData {
  if (
    (value.status === "authorized" || value.status === "captured") &&
    value.authorizationId === undefined
  ) {
    throw new InvalidPaymentError("承認済みの支払いには承認IDが必要です");
  }

  if (value.status === "pending" && value.authorizationId !== undefined) {
    throw new InvalidPaymentError("処理待ちの支払いに承認IDを設定できません");
  }

  if (value.status === "failed" && value.failureReason === undefined) {
    throw new InvalidPaymentError("失敗した支払いには理由が必要です");
  }

  if (value.status !== "failed" && value.failureReason !== undefined) {
    throw new InvalidPaymentError("失敗していない支払いに失敗理由を設定できません");
  }

  return {
    id: value.id,
    orderId: value.orderId,
    amount: value.amount,
    currency: value.currency,
    status: value.status,
    authorizationId: value.authorizationId,
    failureReason: value.failureReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function validateEvent(input: { now: string; eventId: string }) {
  if (!isNonEmptyString(input.eventId) || !isTimestamp(input.now)) {
    throw new InvalidPaymentError("支払いイベントのID・日時が不正です");
  }
}

/** 決済状態の遷移だけを表し、実際の課金や外部プロバイダーへの通信は行わない。 */
export class PaymentEntity<S extends PaymentStatus> {
  // 終了状態からの再操作を型で防ぎ、各メソッドでも実行時に状態を確認する。
  declare private readonly stateBrand: S;
  readonly id: string;
  readonly orderId: string;
  readonly amount: PaymentAmount;
  readonly currency: CurrencyCode;
  readonly status: S;
  readonly authorizationId?: string;
  readonly failureReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly PaymentDomainEvent[];

  private constructor(snapshot: PaymentData<S>, events: readonly PaymentDomainEvent[]) {
    this.id = snapshot.id;
    this.orderId = snapshot.orderId;
    this.amount = snapshot.amount;
    this.currency = snapshot.currency;
    this.status = snapshot.status;
    this.authorizationId = snapshot.authorizationId;
    this.failureReason = snapshot.failureReason;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.events = Object.freeze(events);
    Object.freeze(this);
  }

  static initiate(input: {
    id: string;
    orderId: string;
    amount: PaymentAmount;
    currency: CurrencyCode;
    now: string;
    eventId: string;
  }): PaymentEntity<"pending"> {
    const snapshot: PaymentData<"pending"> = {
      id: input.id,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      status: "pending",
      createdAt: input.now,
      updatedAt: input.now,
    };
    if (!isNonEmptyString(input.id) || !isNonEmptyString(input.orderId)) {
      throw new InvalidPaymentError("支払いの識別情報が不正です");
    }

    validateEvent(input);
    return new PaymentEntity(snapshot, [
      {
        id: input.eventId,
        name: "payment.initiated",
        aggregateId: input.id,
        occurredAt: input.now,
        payload: {
          orderId: input.orderId,
          amount: input.amount,
          currency: input.currency,
        },
      },
    ]);
  }

  // 保存済みの状態から復元するだけなので、過去の決済イベントを再発行しない。
  static restore(value: PaymentRestoration): Payment {
    const snapshot = validateRestoration(value);
    switch (snapshot.status) {
      case "pending":
        return new PaymentEntity({ ...snapshot, status: "pending" }, []);
      case "authorized":
        return new PaymentEntity({ ...snapshot, status: "authorized" }, []);
      case "captured":
        return new PaymentEntity({ ...snapshot, status: "captured" }, []);
      case "failed":
        return new PaymentEntity({ ...snapshot, status: "failed" }, []);
      case "voided":
        return new PaymentEntity({ ...snapshot, status: "voided" }, []);
    }
  }

  authorize(
    this: PaymentEntity<"pending">,
    input: { authorizationId: string; now: string; eventId: string },
  ): PaymentEntity<"authorized"> {
    if (this.status !== "pending") {
      throw new InvalidPaymentTransitionError("処理待ちの支払いだけを承認できます");
    }

    if (!isNonEmptyString(input.authorizationId)) {
      throw new InvalidPaymentError("支払い承認IDを指定してください");
    }

    validateEvent(input);
    return new PaymentEntity(
      {
        ...this.data(),
        status: "authorized",
        authorizationId: input.authorizationId,
        updatedAt: input.now,
      },
      [
        {
          id: input.eventId,
          name: "payment.authorized",
          aggregateId: this.id,
          occurredAt: input.now,
          payload: { authorizationId: input.authorizationId },
        },
      ],
    );
  }

  capture(
    this: PaymentEntity<"authorized">,
    input: { now: string; eventId: string },
  ): PaymentEntity<"captured"> {
    if (this.status !== "authorized") {
      throw new InvalidPaymentTransitionError("承認済みの支払いだけを売上確定できます");
    }

    validateEvent(input);
    return new PaymentEntity({ ...this.data(), status: "captured", updatedAt: input.now }, [
      {
        id: input.eventId,
        name: "payment.captured",
        aggregateId: this.id,
        occurredAt: input.now,
        payload: { amount: this.amount },
      },
    ]);
  }

  fail(
    this: PaymentEntity<"pending"> | PaymentEntity<"authorized">,
    input: { reason: string; now: string; eventId: string },
  ): PaymentEntity<"failed"> {
    if (this.status !== "pending" && this.status !== "authorized") {
      throw new InvalidPaymentTransitionError("終了した支払いを失敗状態へ変更できません");
    }

    if (!isNonEmptyString(input.reason)) {
      throw new InvalidPaymentError("支払いの失敗理由を指定してください");
    }

    validateEvent(input);
    return new PaymentEntity(
      { ...this.data(), status: "failed", failureReason: input.reason, updatedAt: input.now },
      [
        {
          id: input.eventId,
          name: "payment.failed",
          aggregateId: this.id,
          occurredAt: input.now,
          payload: { reason: input.reason },
        },
      ],
    );
  }

  void(
    this: PaymentEntity<"pending"> | PaymentEntity<"authorized">,
    input: { now: string; eventId: string },
  ): PaymentEntity<"voided"> {
    if (this.status !== "pending" && this.status !== "authorized") {
      throw new InvalidPaymentTransitionError("売上確定前の支払いだけを取り消せます");
    }

    validateEvent(input);
    return new PaymentEntity({ ...this.data(), status: "voided", updatedAt: input.now }, [
      {
        id: input.eventId,
        name: "payment.voided",
        aggregateId: this.id,
        occurredAt: input.now,
        payload: { orderId: this.orderId },
      },
    ]);
  }

  private data(): PaymentData<S> {
    return {
      id: this.id,
      orderId: this.orderId,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      authorizationId: this.authorizationId,
      failureReason: this.failureReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toSnapshot(): PaymentSnapshot<S> {
    return { ...this.data(), amount: this.amount, currency: this.currency };
  }
}
