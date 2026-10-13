import { createOrderInputSchema } from "#api/application/order/dtos/create-order-input.ts";
import { CreateOrderInputDto } from "#api/application/order/dtos/create-order-input-dto.ts";
import { z } from "zod";
import { productEntity } from "#api/test/domain-values.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import { CUSTOMER_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import type { Order } from "#api/domain/order/entities/order.ts";
import { expect, it, vi } from "vite-plus/test";
import { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

class MemoryOrderRepository implements Pick<OrderRepository, "save" | "find" | "update"> {
  saved: Order | undefined;

  async save(order: Order) {
    this.saved = order;
  }

  async find() {
    return this.saved ?? null;
  }

  async update(order: Order) {
    this.saved = order;
    return true;
  }
}

it("注文作成ユースケース（CreateOrderUseCase） / 保存後の通信障害では取得したエンティティから応答を返し、予約を解放しない", async () => {
  const orders = new MemoryOrderRepository();
  // DBの失敗ではなく、保存成功後に応答だけ失われるケースを再現する。
  const save = orders.save.bind(orders);
  vi.spyOn(orders, "save").mockImplementation(async (order) => {
    await save(order);
    throw new Error("通信障害");
  });
  const inventory = {
    reserve: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
    commit: vi.fn(),
  } satisfies InventoryGateway;
  const result = await new CreateOrderUseCase(orders, inventory, {
    findBySkus: async (_tenant, skus) =>
      skus.map((sku) =>
        productEntity({ sku, name: "商品", unitPrice: sku === "SKU-1" ? 2400 : 100 }),
      ),
  }).execute(
    CreateOrderInputDto.parse({
      identity: await authorizedActor({
        userId: "user-1",
        tenantId: "store-1",
        channel: "customer",
        role: "admin",
        permissions: CUSTOMER_PERMISSIONS,
      }),
      lines: [{ sku: "s1", name: "商品", quantity: 1, unitPrice: 100 }],
    }),
  );
  expect(result).toEqual(orders.saved?.toSnapshot());
  expect(inventory.release).not.toHaveBeenCalled();
});
it("注文作成ユースケース（CreateOrderUseCase） / 注文を保存する前に在庫を予約する", async () => {
  const orders = new MemoryOrderRepository();
  const reserve = vi.fn().mockResolvedValue(undefined);
  const inventory: InventoryGateway = {
    reserve,
    release: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  const useCase = new CreateOrderUseCase(orders, inventory, {
    findBySkus: async (_tenant, skus) =>
      skus.map((sku) =>
        productEntity({ sku, name: "商品", unitPrice: sku === "SKU-1" ? 2400 : 100 }),
      ),
  });
  const result = await useCase.execute(
    CreateOrderInputDto.parse({
      identity: await authorizedActor({
        userId: "user-1",
        tenantId: "store-1",
        channel: "customer",
        role: "admin",
        permissions: CUSTOMER_PERMISSIONS,
      }),
      lines: [{ sku: "SKU-1", name: "Edge Mug", quantity: 2, unitPrice: 2400 }],
    }),
  );
  expect(reserve).toHaveBeenCalledWith({
    tenantId: "store-1",
    orderId: result.id,
    sku: "SKU-1",
    quantity: 2,
  });
  expect(orders.saved?.id).toBe(result.id);
});
it("不正な数量は入力境界で400になり、予約・保存を行わない", async () => {
  const orders = new MemoryOrderRepository();
  const reserve = vi.fn<InventoryGateway["reserve"]>();
  const inventory: InventoryGateway = {
    reserve,
    release: vi.fn(),
    cancel: vi.fn(),
    commit: vi.fn(),
  };
  await expect(
    new CreateOrderUseCase(orders, inventory, {
      findBySkus: async (_tenant, skus) =>
        skus.map((sku) =>
          productEntity({ sku, name: "商品", unitPrice: sku === "SKU-1" ? 2400 : 100 }),
        ),
    }).execute(
      CreateOrderInputDto.parse({
        identity: await authorizedActor({
          userId: "u1",
          tenantId: "t1",
          channel: "customer",
          role: "admin",
          permissions: CUSTOMER_PERMISSIONS,
        }),
        lines: [{ sku: "s1", name: "商品", quantity: 101, unitPrice: 100 }],
      }),
    ),
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "数量は1以上100以下の整数にしてください",
  });
  expect(reserve).not.toHaveBeenCalled();
  expect(orders.saved).toBeUndefined();
});
it("プレーンな実行者のコピーでも認可されたテナントに注文を保存する", async () => {
  const orders = new MemoryOrderRepository();
  const inventory = {
    reserve: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    cancel: vi.fn(),
    commit: vi.fn(),
  } satisfies InventoryGateway;
  const actor = await authorizedActor({
    userId: "u1",
    tenantId: "t1",
    channel: "customer",
    role: "admin",
    permissions: CUSTOMER_PERMISSIONS,
  });
  const result = await new CreateOrderUseCase(orders, inventory, {
    findBySkus: async (_tenant, skus) =>
      skus.map((sku) =>
        productEntity({ sku, name: "商品", unitPrice: sku === "SKU-1" ? 2400 : 100 }),
      ),
  }).execute(
    CreateOrderInputDto.parse({
      identity: { ...actor },
      lines: [{ sku: "s1", name: "マグ", quantity: 1, unitPrice: 100 }],
    }),
  );
  expect(result).toMatchObject({ tenantId: "t1", customerId: "u1" });
  expect(orders.saved?.id).toBe(result.id);
});
it("予約中に入力の実行者を差し替えても元のテナントで結果確認と補償を行う", async () => {
  const orders = new MemoryOrderRepository();
  const actor = await authorizedActor({
    userId: "u1",
    tenantId: "t1",
    channel: "customer",
    role: "admin",
    permissions: CUSTOMER_PERMISSIONS,
  });
  const otherActor = await authorizedActor({
    userId: "u2",
    tenantId: "t2",
    channel: "customer",
    role: "admin",
    permissions: CUSTOMER_PERMISSIONS,
  });
  const input: z.input<typeof createOrderInputSchema> = {
    identity: actor,
    lines: [{ sku: "s1", name: "マグ", quantity: 1, unitPrice: 100 }],
  };
  const find = vi.spyOn(orders, "find");
  const inventory = {
    reserve: vi.fn<InventoryGateway["reserve"]>(async () => {
      input.identity = otherActor;
      throw new Error("予約応答の消失");
    }),
    release: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
    commit: vi.fn(),
  } satisfies InventoryGateway;
  await expect(
    new CreateOrderUseCase(orders, inventory, {
      findBySkus: async (_tenant, skus) =>
        skus.map((sku) =>
          productEntity({ sku, name: "商品", unitPrice: sku === "SKU-1" ? 2400 : 100 }),
        ),
    }).execute(CreateOrderInputDto.parse(input)),
  ).rejects.toThrow("予約応答の消失");
  expect(find).toHaveBeenCalledWith("t1", expect.any(String));
  expect(inventory.release).toHaveBeenCalledWith({
    tenantId: "t1",
    orderId: expect.any(String),
    sku: "s1",
  });
});
it.each(["business", "admin"] as const)(
  "%sは内部ユースケースからも代理注文を作成できない",
  async (channel) => {
    const orders = new MemoryOrderRepository();
    const inventory = { reserve: vi.fn(), release: vi.fn(), cancel: vi.fn(), commit: vi.fn() };
    const products = { findBySkus: vi.fn() };
    const actor = await authorizedActor({
      userId: "u1",
      tenantId: "t1",
      channel,
      role: "admin",
      permissions: [],
    });
    await expect(
      new CreateOrderUseCase(orders, inventory, products).execute(
        CreateOrderInputDto.parse({
          identity: actor,
          lines: [{ sku: "s1", name: "代理注文", quantity: 1, unitPrice: 100 }],
        }),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(products.findBySkus).not.toHaveBeenCalled();
    expect(inventory.reserve).not.toHaveBeenCalled();
    expect(orders.saved).toBeUndefined();
  },
);
