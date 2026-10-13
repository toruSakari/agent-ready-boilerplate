import { InventoryOverviewListInputDto } from "#api/application/inventory/dtos/inventory-overview-list-input-dto.ts";
import { InventoryOverviewHistoryInputDto } from "#api/application/inventory/dtos/inventory-overview-history-input-dto.ts";
import { restoreStoredInventory } from "#api/infrastructure/inventory/mappers/restore-stored-inventory.ts";
import { productEntity } from "#api/test/domain-values.ts";
import { expect, it, vi } from "vite-plus/test";
import { InventoryOverviewUseCase } from "#api/application/inventory/use-cases/inventory-overview-use-case.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";

const actor = () =>
  authorizedActor({ userId: "merchant", tenantId: "shop", role: "admin", permissions: [] });

function setup() {
  const list = vi
    .fn()
    .mockResolvedValue([productEntity({ sku: "S1", name: "商品", unitPrice: 100 })]);
  const history = vi.fn().mockResolvedValue([]);
  const find = vi
    .fn()
    .mockResolvedValue(productEntity({ sku: "S1", name: "商品", unitPrice: 100 }));
  const getStock = vi.fn().mockResolvedValue([
    restoreStoredInventory({
      sku: "S1",
      onHand: 3,
      reservations: [{ orderId: "reserved", quantity: 2 }],
    }),
  ]);
  return {
    list,
    history,
    find,
    getStock,
    useCase: new InventoryOverviewUseCase({ history }, { list, find }, { findMany: getStock }),
  };
}

it("在庫一覧は認可された企業に限定し、DOの予約済み数量を取得する", async () => {
  const { list, getStock, useCase } = setup();
  const result = await useCase
    .list(InventoryOverviewListInputDto.parse({ actor: await actor(), request: { limit: 1 } }))
    .then((result) => result.items);
  expect(list).toHaveBeenCalledWith("shop", { limit: 1 }, undefined);
  expect(getStock).toHaveBeenCalledWith("shop", ["S1"]);
  expect(result[0]).toMatchObject({ onHand: 3, reserved: 2, available: 1 });
});
it("他企業の商品では履歴を照会しない", async () => {
  const { find, history, useCase } = setup();
  find.mockResolvedValue(null);
  await expect(
    useCase
      .history(InventoryOverviewHistoryInputDto.parse({ actor: await actor(), id: "other" }))
      .then((result) => result.items),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(history).not.toHaveBeenCalled();
});
it("DO障害を0在庫に変換せず取得エラーとして返す", async () => {
  const { getStock, useCase } = setup();
  getStock.mockRejectedValue(new Error("障害"));
  await expect(
    useCase
      .list(InventoryOverviewListInputDto.parse({ actor: await actor() }))
      .then((result) => result.items),
  ).rejects.toThrow("障害");
});
it("在庫一覧はDO照会のページ上限を守る", async () => {
  const { list, useCase } = setup();
  await expect(
    useCase
      .list(InventoryOverviewListInputDto.parse({ actor: await actor(), request: { limit: 26 } }))
      .then((result) => result.items),
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(list).not.toHaveBeenCalled();
});
