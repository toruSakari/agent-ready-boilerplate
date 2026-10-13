import { expect, it, vi } from "vite-plus/test";
import { adjustStock } from "#api/infrastructure/inventory/durable-objects/adjust-stock.ts";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";

function fixture() {
  const input = {
    operationId: crypto.randomUUID(),
    sku: "S1",
    actorId: "business:staff",
    adjustment: { operation: "receive", quantity: 2, reason: "delivery" },
  };
  const current = InventoryItem.restore({
    sku: Sku.create(input.sku),
    onHand: StockQuantity.create(3),
    reservations: [],
  });
  const saveAdjustment = vi
    .fn<(item: InventoryItem, entry: StockAdjustmentEntry) => Promise<void>>()
    .mockResolvedValue(undefined);
  const find = vi.fn<() => Promise<StockAdjustmentEntry | null>>().mockResolvedValue(null);
  const load = vi.fn().mockResolvedValue(current);
  const call = () =>
    adjustStock(
      new Request("https://inventory/adjustments", { method: "POST", body: JSON.stringify(input) }),
      "tenant",
      { saveAdjustment },
      { find },
      load,
    );
  return { input, current, saveAdjustment, find, load, call };
}

it("入荷は変更後の在庫Entityと対応する履歴EntityをRepositoryへ一度渡す", async () => {
  const { input, current, saveAdjustment, find, call } = fixture();
  const response = await call();
  expect(await response.json()).toEqual({ stock: 5, reserved: 0, available: 5 });
  expect(find).toHaveBeenCalledWith("tenant", input.operationId);
  expect(saveAdjustment).toHaveBeenCalledTimes(1);
  const [item, entry] = saveAdjustment.mock.calls[0]!;
  expect(item).toBeInstanceOf(InventoryItem);
  expect(item).not.toBe(current);
  expect(item.onHand).toBe(5);
  expect(entry).toBeInstanceOf(StockAdjustmentEntry);
  expect(entry.toSnapshot()).toMatchObject({
    id: input.operationId,
    tenantId: "tenant",
    sku: item.sku,
    beforeStock: current.onHand,
    afterStock: item.onHand,
    createdAt: item.events[0]?.occurredAt,
  });
});

it("保存後の再試行は履歴をEntityで照合し、読み直した現在庫だけを返す", async () => {
  const { saveAdjustment, find, load, call } = fixture();
  await call();
  const [changed, entry] = saveAdjustment.mock.calls[0]!;
  find.mockResolvedValue(entry);
  load.mockResolvedValue(changed);
  const response = await call();
  expect(await response.json()).toEqual({ stock: 5, reserved: 0, available: 5 });
  expect(saveAdjustment).toHaveBeenCalledTimes(1);
});

it("同じIDの異なる担当者は在庫を読み書きせず拒否する", async () => {
  const { input, saveAdjustment, find, load, call } = fixture();
  await call();
  find.mockResolvedValue(saveAdjustment.mock.calls[0]![1]);
  input.actorId = "business:other";
  expect((await call()).status).toBe(409);
  expect(load).toHaveBeenCalledTimes(1);
  expect(saveAdjustment).toHaveBeenCalledTimes(1);
});

it("原子保存の失敗を成功に変換せず、別の在庫保存も追加しない", async () => {
  const { saveAdjustment, call } = fixture();
  saveAdjustment.mockRejectedValue(new Error("D1 failure"));
  await expect(call()).rejects.toThrow("D1 failure");
  expect(saveAdjustment).toHaveBeenCalledTimes(1);
});
