import { expect, it } from "vite-plus/test";
import {
  adjustedStock,
  stockAdjustmentSchema,
} from "#api/domain/inventory/policies/stock-adjustment.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";

it("入荷は加算し、棚卸しは実数へ置換する", () => {
  expect(
    adjustedStock(StockQuantity.create(3), {
      operation: "receive",
      quantity: 10,
      reason: "delivery",
    }),
  ).toBe(13);
  expect(
    adjustedStock(StockQuantity.create(13), {
      operation: "recount",
      quantity: 0,
      expectedStock: 13,
      reason: "stocktake",
    }),
  ).toBe(0);
});
it.each([0, -1, 0.5])("入荷の不正数量%dを拒否する", (quantity) => {
  expect(
    stockAdjustmentSchema.safeParse({ operation: "receive", quantity, reason: "delivery" }).success,
  ).toBe(false);
});
it("操作に合わない理由と棚卸しの比較値欠落を拒否する", () => {
  expect(
    stockAdjustmentSchema.safeParse({ operation: "receive", quantity: 1, reason: "damage" })
      .success,
  ).toBe(false);
  expect(
    stockAdjustmentSchema.safeParse({ operation: "recount", quantity: 1, reason: "stocktake" })
      .success,
  ).toBe(false);
});
it("加算による数量上限超過を拒否する", () => {
  expect(() =>
    adjustedStock(StockQuantity.create(Number.MAX_SAFE_INTEGER), {
      operation: "receive",
      quantity: 1,
      reason: "delivery",
    }),
  ).toThrow();
});
