import { z } from "zod";
import { CreateOrderInputDto } from "#api/application/order/dtos/create-order-input-dto.ts";
import { ManageOrderInputDto } from "#api/application/order/dtos/manage-order-input-dto.ts";
import { productEntity } from "#api/test/domain-values.ts";
import { expect, it, vi } from "vite-plus/test";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";
import type { Order } from "#api/domain/order/entities/order.ts";

async function setup(price = 2400) {
  const identity = await authorizedActor({
    userId: "customer",
    tenantId: "tenant-a",
    channel: "customer",
    role: "member",
    permissions: ["order:create", "order:update"],
  });
  let current: Order | undefined;
  const orders = {
    save: vi.fn(async (order: Order) => {
      current = order;
    }),
    find: vi.fn(async () => current ?? null),
    update: vi.fn(async (order: Order, version: number) => {
      if (current?.version !== version) {
        return false;
      }

      current = order;
      return true;
    }),
  } satisfies Pick<OrderRepository, "save" | "find" | "update">;
  const inventory = {
    reserve: vi.fn(),
    release: vi.fn(),
    cancel: vi.fn(),
    commit: vi.fn(),
  } satisfies InventoryGateway;
  const products = {
    findBySkus: vi
      .fn<ProductRepository["findBySkus"]>()
      .mockResolvedValue([productEntity({ sku: "mug", name: "正規の商品名", unitPrice: price })]),
  };
  return {
    identity,
    orders,
    inventory,
    products,
    create: new CreateOrderUseCase(orders, inventory, products),
    manage: new ManageOrderUseCase(orders, inventory, products),
  };
}

const forged = [{ sku: "mug", name: "勝手な商品名", quantity: 2, unitPrice: 0 }];
it.each([false, true])(
  "顧客注文の価格確定 / 下書き%sでも顧客の0円改ざんを保存・予約前に拒否する",
  async (draft) => {
    const { create, identity, products, orders, inventory } = await setup();
    await expect(
      create.execute(CreateOrderInputDto.parse({ identity, lines: forged, draft })),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(orders.save).not.toHaveBeenCalled();
    expect(inventory.reserve).not.toHaveBeenCalled();
    expect(products.findBySkus).toHaveBeenCalledWith("tenant-a", ["mug"]);
  },
);
it("顧客注文の価格確定 / 価格が一致する場合はサーバーの商品情報で保存する", async () => {
  const { create, identity } = await setup();
  const result = await create.execute(
    CreateOrderInputDto.parse({
      identity,
      lines: [{ ...forged[0]!, unitPrice: 2400 }],
      draft: true,
    }),
  );
  expect(result.lines[0]).toMatchObject({ name: "正規の商品名", unitPrice: 2400 });
  expect(result.total).toBe(4800);
});
it("顧客注文の価格確定 / 商品が無料なら0円を許可する", async () => {
  const { create, identity } = await setup(0);
  expect((await create.execute(CreateOrderInputDto.parse({ identity, lines: forged }))).total).toBe(
    0,
  );
});
it("顧客注文の価格確定 / 選択企業にないSKUは予約・保存前に拒否する", async () => {
  const { create, identity, products, orders, inventory } = await setup();
  products.findBySkus.mockResolvedValue([]);
  await expect(
    create.execute(CreateOrderInputDto.parse({ identity, lines: forged })),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(orders.save).not.toHaveBeenCalled();
  expect(inventory.reserve).not.toHaveBeenCalled();
});
it("顧客注文の価格確定 / 負の単価はValue Objectで拒否する", async () => {
  const { create, identity, products } = await setup();
  await expect(
    create.execute(
      CreateOrderInputDto.parse({ identity, lines: [{ ...forged[0]!, unitPrice: -1 }] }),
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(products.findBySkus).not.toHaveBeenCalled();
});
it("顧客注文の価格確定 / 編集の改ざんと価格変更後の確定を拒否し、再編集後に確定できる", async () => {
  const { create, manage, identity, products, orders, inventory } = await setup();
  const draft = await create.execute(
    CreateOrderInputDto.parse({
      identity,
      lines: [{ ...forged[0]!, unitPrice: 2400 }],
      draft: true,
    }),
  );
  await expect(
    executeCommand(manage, { identity, id: draft.id, version: draft.version, lines: forged }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(orders.update).not.toHaveBeenCalled();
  const edited = await executeCommand(manage, {
    identity,
    id: draft.id,
    version: draft.version,
    lines: [{ ...forged[0]!, unitPrice: 2400 }],
  });
  expect(edited.total).toBe(4800);
  products.findBySkus.mockResolvedValue([
    productEntity({ sku: "mug", name: "更新後の商品名", unitPrice: 3000 }),
  ]);
  orders.update.mockClear();
  await expect(
    executeCommand(manage, {
      identity,
      id: draft.id,
      version: edited.version,
      status: "confirmed",
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(orders.update).not.toHaveBeenCalled();
  expect(inventory.reserve).not.toHaveBeenCalled();
  const repriced = await executeCommand(manage, {
    identity,
    id: draft.id,
    version: edited.version,
    lines: [{ ...forged[0]!, unitPrice: 3000 }],
  });
  const confirmed = await executeCommand(manage, {
    identity,
    id: draft.id,
    version: repriced.version,
    status: "confirmed",
  });
  assertRepricedConfirmation(confirmed, repriced.version, orders, inventory);
});

function assertRepricedConfirmation(
  confirmed: Awaited<ReturnType<ManageOrderUseCase["execute"]>>,
  previousVersion: number,
  orders: Awaited<ReturnType<typeof setup>>["orders"],
  inventory: Awaited<ReturnType<typeof setup>>["inventory"],
) {
  expect(confirmed.total).toBe(6000);
  expect(confirmed.version).toBe(previousVersion + 1);
  expect(confirmed.lines[0]?.name).toBe("更新後の商品名");
  expect(orders.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "confirmed" }),
    previousVersion,
  );
  expect(inventory.reserve).toHaveBeenCalledWith(
    expect.objectContaining({ sku: "mug", quantity: 2 }),
  );
}

function executeCommand(
  useCase: ManageOrderUseCase,
  input: z.input<typeof ManageOrderInputDto>["input"],
) {
  return useCase.execute(ManageOrderInputDto.parse({ input }));
}
