import { manageOrderInputSchema } from "#api/application/order/dtos/manage-order-input.ts";
import { CreateOrderInputDto } from "#api/application/order/dtos/create-order-input-dto.ts";
import { z } from "zod";
import { ManageOrderInputDto } from "#api/application/order/dtos/manage-order-input-dto.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { orderValues, productEntity } from "#api/test/domain-values.ts";
import { expect, it, vi } from "vite-plus/test";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import type { Order } from "#api/domain/order/entities/order.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

const identity = {
  userId: "u1",
  tenantId: "t1",
  role: "admin" as const,
  permissions: BUSINESS_PERMISSIONS,
};
const lines = [{ sku: "s1", name: "マグ", quantity: 2, unitPrice: 500 }];

function setup() {
  let current: Order = OrderEntity.draft(
    orderValues({
      id: "o1",
      tenantId: "t1",
      customerId: "u1",
      lines,
      now: "2026-10-02",
      eventId: "e1",
    }),
  );
  const orders = {
    save: vi.fn<OrderRepository["save"]>().mockResolvedValue(undefined),
    find: vi.fn<OrderRepository["find"]>(async (tenant, id) =>
      tenant === "t1" && id === "o1" ? current : null,
    ),
    // 常に成功するモックにせず、読取時の版を比較して楽観ロックの前提を再現する。
    update: vi.fn<OrderRepository["update"]>(async (next, version) => {
      if (current.toSnapshot().version !== version) {
        return false;
      }

      current = next;
      return true;
    }),
  } satisfies Pick<OrderRepository, "save" | "find" | "update">;
  const inventory = {
    reserve: vi.fn<InventoryGateway["reserve"]>().mockResolvedValue(undefined),
    release: vi.fn<InventoryGateway["release"]>().mockResolvedValue(undefined),
    commit: vi.fn<InventoryGateway["commit"]>().mockResolvedValue(undefined),
    cancel: vi.fn<InventoryGateway["cancel"]>().mockResolvedValue(undefined),
  } satisfies InventoryGateway;
  return {
    orders,
    inventory,
    current: () => current.toSnapshot(),
    useCase: new ManageOrderUseCase(orders, inventory, { findBySkus: async () => [] }),
  };
}

it("注文管理 / 下書きは在庫予約せず作成できる", async () => {
  const { orders, inventory } = setup();
  const result = await new CreateOrderUseCase(orders, inventory, {
    findBySkus: async () => [productEntity({ sku: "s1", name: "マグ", unitPrice: 500 })],
  }).execute(
    CreateOrderInputDto.parse({
      identity: await authorizedActor({
        ...identity,
        channel: "customer",
        permissions: CUSTOMER_PERMISSIONS,
      }),
      lines,
      draft: true,
    }),
  );
  expect(result.status).toBe("draft");
  expect(result.reservationId).toBeNull();
  expect(inventory.reserve).not.toHaveBeenCalled();
});
it("注文管理 / 下書きの明細と合計を更新し、確定・出荷・完了へ進める", async () => {
  const { useCase, inventory } = setup();
  const edited = await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 0,
    lines: [{ ...lines[0]!, quantity: 3 }],
  });
  expect(edited.total).toBe(1500);
  expect(edited.version).toBe(1);
  expect(inventory.reserve).not.toHaveBeenCalled();
  const confirmed = await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 1,
    status: "confirmed",
  });
  expect(inventory.reserve).toHaveBeenCalledWith({
    tenantId: "t1",
    orderId: confirmed.reservationId,
    sku: "s1",
    quantity: 3,
  });
  expect(confirmed.reservationId).not.toBe("o1");
  await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 2,
    status: "shipped",
  });
  const completed = await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 3,
    status: "completed",
  });
  expect(completed.status).toBe("completed");
});
it("注文管理 / 古い更新番号・他テナントを業務側で、更新権限不足を認可境界で拒否する", async () => {
  const { useCase, orders, inventory } = setup();
  await expect(
    executeCommand(useCase, {
      identity: await authorizedActor(identity),
      id: "o1",
      version: 4,
      status: "confirmed",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    executeCommand(useCase, {
      identity: await authorizedActor({ ...identity, tenantId: "t2" }),
      id: "o1",
      version: 0,
      status: "cancelled",
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(async () =>
    executeCommand(useCase, {
      identity: await authorizedActor(
        {
          ...identity,
          role: "member",
          permissions: ["order:read", "product.read"] as const,
        },
        ["order:update"],
      ),
      id: "o1",
      version: 0,
      status: "cancelled",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(orders.update).not.toHaveBeenCalled();
  expect(inventory.reserve).not.toHaveBeenCalled();
});
it("注文管理 / 確定済みの明細変更と出荷後キャンセルを拒否する", async () => {
  const { useCase } = setup();
  await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 0,
    status: "confirmed",
  });
  await expect(
    executeCommand(useCase, {
      identity: await authorizedActor(identity),
      id: "o1",
      version: 1,
      lines,
    }),
  ).rejects.toMatchObject({
    code: "CONFLICT",
  });
  await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 1,
    status: "shipped",
  });
  await expect(
    executeCommand(useCase, {
      identity: await authorizedActor(identity),
      id: "o1",
      version: 2,
      status: "cancelled",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("注文管理 / 下書きのキャンセルは在庫操作を行わず、再確定を拒否する", async () => {
  const { useCase, inventory } = setup();
  const cancelled = await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 0,
    status: "cancelled",
  });
  expect(cancelled.reservationId).toBeNull();
  expect(inventory.reserve).not.toHaveBeenCalled();
  await expect(
    executeCommand(useCase, {
      identity: await authorizedActor(identity),
      id: "o1",
      version: 1,
      status: "confirmed",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("注文管理 / 保存競合時は今回の試行だけの予約を解放する", async () => {
  const { useCase, orders, inventory, current } = setup();
  orders.update.mockResolvedValue(false);
  await expect(
    executeCommand(useCase, {
      identity: await authorizedActor(identity),
      id: "o1",
      version: 0,
      status: "confirmed",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(inventory.release).toHaveBeenCalledWith({
    tenantId: "t1",
    orderId: inventory.reserve.mock.calls[0]![0].orderId,
    sku: "s1",
  });
  expect(current().status).toBe("draft");
});
it("注文管理 / 途中のSKUで予約に失敗したら、試行した予約を解放する", async () => {
  const { useCase, inventory, current } = setup();
  await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 0,
    lines: [...lines, { ...lines[0]!, sku: "s2" }],
  });
  inventory.reserve.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("在庫不足"));
  await expect(
    executeCommand(useCase, {
      identity: await authorizedActor(identity),
      id: "o1",
      version: 1,
      status: "confirmed",
    }),
  ).rejects.toThrow("在庫不足");
  expect(inventory.release).toHaveBeenCalledTimes(2);
  expect(inventory.release.mock.calls.map((props) => props[0].sku)).toEqual(["s1", "s2"]);
  expect(current().status).toBe("draft");
});
it("注文管理 / 重複SKUを予約する前に拒否する", async () => {
  const { orders, inventory } = setup();
  await expect(
    new CreateOrderUseCase(orders, inventory, {
      findBySkus: async () => [productEntity({ sku: "s1", name: "マグ", unitPrice: 500 })],
    }).execute(
      CreateOrderInputDto.parse({
        identity: await authorizedActor({
          ...identity,
          channel: "customer",
          permissions: CUSTOMER_PERMISSIONS,
        }),
        lines: [...lines, ...lines],
      }),
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(inventory.reserve).not.toHaveBeenCalled();
});
it("D1保存直後の通信障害でも成功した確定の予約を消さない", async () => {
  const { useCase, orders, inventory, current } = setup();
  const persist = orders.update.getMockImplementation()!;
  orders.update.mockImplementation(async (next, version) => {
    await persist(next, version);
    throw new Error("通信が切断されました");
  });
  const result = await executeCommand(useCase, {
    identity: await authorizedActor(identity),
    id: "o1",
    version: 0,
    status: "confirmed",
  });
  expect(result.status).toBe("confirmed");
  expect(current().reservationId).toBe(result.reservationId);
  expect(inventory.release).not.toHaveBeenCalled();
});
it("読込中に入力の実行者を差し替えても元の顧客の所有制約を適用する", async () => {
  const { useCase, orders, inventory } = setup();
  const customer = await authorizedActor({
    userId: "other-customer",
    tenantId: "t1",
    channel: "customer",
    role: "member",
    permissions: ["order:update"],
  });
  const business = await authorizedActor(identity);
  const input: z.input<typeof manageOrderInputSchema> = {
    identity: customer,
    id: "o1",
    version: 0,
    status: "cancelled",
  };
  const find = orders.find.getMockImplementation()!;
  orders.find.mockImplementation(async (tenantId, id) => {
    input.identity = business;
    return find(tenantId, id);
  });
  await expect(executeCommand(useCase, input)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(orders.update).not.toHaveBeenCalled();
  expect(inventory.reserve).not.toHaveBeenCalled();
});

function executeCommand(
  useCase: ManageOrderUseCase,
  input: z.input<typeof ManageOrderInputDto>["input"],
) {
  return useCase.execute(ManageOrderInputDto.parse({ input }));
}
