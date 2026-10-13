import { ManageStockChangeInputDto } from "#api/application/inventory/dtos/manage-stock-change-input-dto.ts";
import { ManageStockGetInputDto } from "#api/application/inventory/dtos/manage-stock-get-input-dto.ts";
import { restoreStoredInventory } from "#api/infrastructure/inventory/mappers/restore-stored-inventory.ts";
import { productEntity } from "#api/test/domain-values.ts";
import { expect, it, vi } from "vite-plus/test";
import { ManageStockUseCase } from "#api/application/inventory/use-cases/manage-stock-use-case.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";

const actor = () =>
  authorizedActor({ userId: "merchant", tenantId: "shop", role: "admin", permissions: [] });

function setup(sku: string | null = "S1") {
  const find = vi
    .fn()
    .mockResolvedValue(sku === null ? null : productEntity({ sku, name: "商品", unitPrice: 100 }));
  const adjustStock = vi.fn().mockResolvedValue({ onHand: 4, reserved: 1, available: 3 });
  return {
    find,
    changeStock: adjustStock,
    useCase: new ManageStockUseCase(
      { find },
      { adjustStock, changeStock: vi.fn() },
      {
        find: vi.fn().mockResolvedValue(
          restoreStoredInventory({
            sku: "S1",
            onHand: 4,
            reservations: [{ orderId: "private-order", quantity: 1 }],
          }),
        ),
      },
    ),
  };
}

it("企業と商品IDでSKUを解決し、期待在庫と一緒にDOへ渡す", async () => {
  const { find, changeStock, useCase } = setup();
  await useCase.change(
    ManageStockChangeInputDto.parse({
      actor: await actor(),
      input: { id: "p1", quantity: 4, expectedStock: 2 },
    }),
  );
  expect(find).toHaveBeenCalledWith("shop", "p1");
  expect(changeStock).toHaveBeenCalledWith({
    tenantId: "shop",
    sku: "S1",
    quantity: 4,
    expectedStock: 2,
    operation: "recount",
    reason: "correction",
    operationId: expect.any(String),
    actorId: "merchant",
  });
});
it("他企業の商品は在庫へアクセスしない", async () => {
  const { changeStock, useCase } = setup(null);
  await expect(
    useCase.change(
      ManageStockChangeInputDto.parse({
        actor: await actor(),
        input: { id: "other", quantity: 4, expectedStock: 2 },
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(changeStock).not.toHaveBeenCalled();
});
it.each([-1, 0.2, Number.MAX_SAFE_INTEGER + 1])("不正な在庫%dを拒否する", async (quantity) => {
  const { changeStock, useCase } = setup();
  await expect(
    useCase.change(
      ManageStockChangeInputDto.parse({
        actor: await actor(),
        input: { id: "p1", quantity, expectedStock: 2 },
      }),
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(changeStock).not.toHaveBeenCalled();
});
it("在庫取得はEntityを受け取り、注文IDを公開DTOへ含めない", async () => {
  const { useCase } = setup();
  expect(
    await useCase.get(ManageStockGetInputDto.parse({ actor: await actor(), id: "p1" })),
  ).toEqual({
    onHand: 4,
    reserved: 1,
    available: 3,
  });
});
