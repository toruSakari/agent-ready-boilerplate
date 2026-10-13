import { expect, it } from "vite-plus/test";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";

const receipt = {
  id: "adjustment",
  tenantId: "shop",
  sku: "mug",
  actorId: "business:staff",
  operation: "receive",
  reason: "delivery",
  quantity: 3,
  beforeStock: 2,
  afterStock: 5,
  expectedStock: null,
  createdAt: "2026-10-11",
  actorName: "担当者",
};
it("在庫変更履歴 / 数量の不整合と不正な保存値を復元時に拒否する", () => {
  expect(StockAdjustmentEntry.restore(receipt).toSnapshot()).toMatchObject({
    quantity: 3,
    afterStock: 5,
  });
  expect(() => StockAdjustmentEntry.restore({ ...receipt, afterStock: 4 })).toThrow();
  expect(() => StockAdjustmentEntry.restore({ ...receipt, quantity: -1 })).toThrow();
  expect(() => StockAdjustmentEntry.restore({ ...receipt, createdAt: "invalid" })).toThrow();
});

it("在庫変更履歴 / 新規作成も数量関係を守り、担当者名を持ち込まない", () => {
  const input = {
    ...receipt,
    sku: Sku.create(receipt.sku),
    operation: "receive" as const,
    reason: "delivery" as const,
    quantity: StockQuantity.create(3),
    beforeStock: StockQuantity.create(2),
    afterStock: StockQuantity.create(5),
  };
  const created = StockAdjustmentEntry.create(input);
  expect(created.toSnapshot()).toMatchObject({ quantity: 3, afterStock: 5, actorName: null });
  expect(StockAdjustmentEntry.restore(created.toSnapshot()).toSnapshot()).toEqual(
    created.toSnapshot(),
  );
  expect(() =>
    StockAdjustmentEntry.create({ ...input, afterStock: StockQuantity.create(4) }),
  ).toThrow();
});

it.each([
  { label: "空の操作ID", change: { id: "" } },
  { label: "空の企業ID", change: { tenantId: "" } },
  { label: "空の担当者ID", change: { actorId: "" } },
  { label: "不正な日時", change: { createdAt: "invalid" } },
])("在庫変更履歴 / 新規作成で$labelを拒否する", (input) => {
  const valid = StockAdjustmentEntry.restore(receipt).toSnapshot();
  expect(() => StockAdjustmentEntry.create({ ...valid, ...input.change })).toThrow();
});
