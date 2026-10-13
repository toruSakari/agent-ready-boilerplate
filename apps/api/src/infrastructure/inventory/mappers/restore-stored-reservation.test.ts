import { describe, expect, it } from "vite-plus/test";
import { restoreStoredReservation } from "#api/infrastructure/inventory/mappers/restore-stored-reservation.ts";

const base = { orderId: "o1", sku: "s1", quantity: 2, status: "reserved" };
describe("保存データの復元境界", () => {
  it.each([
    null,
    { ...base, status: "unknown" },
    { ...base, status: "reserved", quantity: 0 },
    { ...base, status: "committed", sku: "" },
  ])("不正な状態・値の復元を拒否する", (snapshot) => {
    expect(() => restoreStoredReservation(snapshot)).toThrow();
  });
});
