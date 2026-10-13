import type { PaymentSnapshot } from "#api/domain/payment/entities/payment.ts";
import { paymentValues } from "#api/test/domain-values.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { describe, expect, it } from "vite-plus/test";
import { InvalidPaymentTransitionError } from "#api/domain/payment/errors/invalid-payment-transition-error.ts";
import { PaymentEntity } from "#api/domain/payment/entities/payment.ts";

describe("決済エンティティ（PaymentEntity）", () => {
  it("決済を未承認から承認済み、売上確定済みへ遷移させる", () => {
    const pending = PaymentEntity.initiate(
      paymentValues({
        id: "payment-1",
        orderId: "order-1",
        amount: 4800,
        currency: "JPY",
        now: "2026-09-30T00:00:00.000Z",
        eventId: "event-1",
      }),
    );
    const authorized = pending.authorize({
      authorizationId: "authorization-1",
      now: "2026-09-30T00:01:00.000Z",
      eventId: "event-2",
    });
    const captured = authorized.capture({
      now: "2026-09-30T00:02:00.000Z",
      eventId: "event-3",
    });

    expect(captured.status).toBe("captured");
    expect(captured.events).toEqual([
      expect.objectContaining({
        name: "payment.captured",
        aggregateId: "payment-1",
      }),
    ]);
  });

  it("未承認の決済は売上を確定できない", () => {
    const payment = PaymentEntity.initiate(
      paymentValues({
        id: "payment-1",
        orderId: "order-1",
        amount: 4800,
        currency: "JPY",
        now: "2026-09-30T00:00:00.000Z",
        eventId: "event-1",
      }),
    );

    expect(() =>
      invokeRuntime(payment, "capture", [
        {
          now: "2026-09-30T00:02:00.000Z",
          eventId: "event-2",
        },
      ]),
    ).toThrow(InvalidPaymentTransitionError);
  });
});

describe("支払い取消", () => {
  it("承認を取り消し、取り消した支払いの売上確定を拒否する", () => {
    const event = { now: "2026-10-02", eventId: "e1" };
    const payment = PaymentEntity.initiate(
      paymentValues({
        id: "p1",
        orderId: "o1",
        amount: 1000,
        currency: "JPY",
        ...event,
      }),
    )
      .authorize({ authorizationId: "a1", ...event })
      .void(event);
    expect(payment.status).toBe("voided");

    expect(() => invokeRuntime(payment, "capture", [event])).toThrow(InvalidPaymentTransitionError);

    expect(() => invokeRuntime(payment, "fail", [{ ...event, reason: "失敗" }])).toThrow(
      InvalidPaymentTransitionError,
    );
  });
});

describe("Paymentの復元境界", () => {
  const pending = PaymentEntity.initiate(
    paymentValues({
      id: "p1",
      orderId: "o1",
      amount: 500,
      currency: "JPY",
      now: "2026-10-02",
      eventId: "e1",
    }),
  );

  it("承認済みとして復元し、状態を絞って売上確定する", () => {
    const authorized = pending.authorize({
      now: "2026-10-02",
      eventId: "e2",
      authorizationId: "a1",
    });
    const restored = restorePaymentFixture(authorized.toSnapshot());
    if (restored.status !== "authorized") {
      throw new Error("想定と異なる状態です");
    }

    expect(restored.capture({ now: "2026-10-02", eventId: "e3" }).status).toBe("captured");
  });
});

// 禁止遷移も実行時に拒否されるかを調べるため、テスト専用のJavaScript呼出し境界を使う。
function uncheckedPaymentAction(
  payment: import("#api/domain/payment/entities/payment.ts").Payment,
  target: "authorized" | "captured" | "failed" | "voided",
) {
  const event = { now: "2026-10-03", eventId: "e2" };
  switch (target) {
    case "authorized":
      return invokeRuntime(payment, "authorize", [{ ...event, authorizationId: "a1" }]);
    case "captured":
      return invokeRuntime(payment, "capture", [event]);
    case "failed":
      return invokeRuntime(payment, "fail", [{ ...event, reason: "拒否" }]);
    case "voided":
      return invokeRuntime(payment, "void", [event]);
  }
}

const paymentStates = ["pending", "authorized", "captured", "failed", "voided"] as const;
const paymentTargets = ["authorized", "captured", "failed", "voided"] as const;
const allowedPaymentEdges = new Set([
  "pending:authorized",
  "pending:failed",
  "pending:voided",
  "authorized:captured",
  "authorized:failed",
  "authorized:voided",
]);
it.each(
  paymentStates.flatMap((source) => paymentTargets.map((target) => [source, target] as const)),
)("決済の全遷移 %s → %s を検証する", (source, target) => {
  const payment = restorePaymentFixture({
    id: "p1",
    orderId: "o1",
    amount: 500,
    currency: "JPY",
    createdAt: "2026-10-02",
    updatedAt: "2026-10-02",
    status: source,
    authorizationId: source === "authorized" || source === "captured" ? "a1" : undefined,
    failureReason: source === "failed" ? "拒否" : undefined,
  });
  if (allowedPaymentEdges.has(`${source}:${target}`)) {
    expect(uncheckedPaymentAction(payment, target)).toMatchObject({ status: target });
    expect(payment.status).toBe(source);
  } else {
    expect(() => uncheckedPaymentAction(payment, target)).toThrow(InvalidPaymentTransitionError);
  }
});

function restorePaymentFixture(value: PaymentSnapshot) {
  return PaymentEntity.restore(paymentValues(value));
}
