import { describe, expect, it } from "vite-plus/test";
import { restoreStoredPayment } from "#api/infrastructure/payment/mappers/restore-stored-payment.ts";

const base = {
  id: "p1",
  orderId: "o1",
  amount: 500,
  currency: "JPY",
  status: "pending",
  createdAt: "2026-10-02",
  updatedAt: "2026-10-02",
};
describe("保存データの復元境界", () => {
  it.each([
    null,
    { ...base, status: "unknown" },
    { ...base, amount: -1 },
    { ...base, status: "authorized", authorizationId: undefined },
    { ...base, status: "failed", failureReason: undefined },
    { ...base, authorizationId: "unexpected" },
    { ...base, currency: "invalid" },
    { ...base, updatedAt: "invalid" },
  ])("不正な保存データからエンティティを作れない", (snapshot) => {
    expect(() => restoreStoredPayment(snapshot)).toThrow();
  });
});
