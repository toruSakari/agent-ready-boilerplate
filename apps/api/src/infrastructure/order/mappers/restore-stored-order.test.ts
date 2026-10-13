import { describe, expect, it } from "vite-plus/test";
import { restoreStoredOrder } from "#api/infrastructure/order/mappers/restore-stored-order.ts";

const base = {
  id: "o1",
  tenantId: "t1",
  customerId: "c1",
  status: "confirmed",
  lines: [{ sku: "s1", name: "マグ", quantity: 2, unitPrice: 500 }],
  total: 1000,
  version: 0,
  createdAt: "2026-10-02",
  reservationId: "r1",
};
describe("保存データの復元境界", () => {
  it.each([
    null,
    { ...base, status: "unknown" },
    { ...base, version: -1 },
    { ...base, total: 1 },
    { ...base, status: "draft", reservationId: "reservation-1" },
    { ...base, reservationId: null },
    { ...base, lines: "invalid" },
    { ...base, createdAt: "invalid" },
  ])("不正な復元データを拒否する", (snapshot) => {
    expect(() => restoreStoredOrder(snapshot)).toThrow();
  });
});
