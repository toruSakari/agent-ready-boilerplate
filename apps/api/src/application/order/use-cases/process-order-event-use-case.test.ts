import { ProcessOrderEventInputDto } from "#api/application/order/dtos/process-order-event-input-dto.ts";
import { orderValues } from "#api/test/domain-values.ts";
import { describe, expect, it, vi } from "vite-plus/test";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import type { Order } from "#api/domain/order/entities/order.ts";
import { ProcessOrderEventUseCase } from "#api/application/order/use-cases/process-order-event-use-case.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

const placed = OrderEntity.place(
  orderValues({
    id: "o1",
    tenantId: "t1",
    customerId: "u1",
    lines: [{ sku: "s1", name: "商品", quantity: 1, unitPrice: 500 }],
    now: "2026-10-02",
    eventId: "placed",
  }),
);

function setup(current: Order) {
  const orders = {
    find: vi.fn<OrderRepository["find"]>().mockResolvedValue(current),
    save: vi.fn<OrderRepository["save"]>(),
    update: vi.fn<OrderRepository["update"]>(),
  } satisfies Pick<OrderRepository, "save" | "find" | "update">;
  const inventory = {
    reserve: vi.fn<InventoryGateway["reserve"]>(),
    release: vi.fn<InventoryGateway["release"]>(),
    commit: vi.fn<InventoryGateway["commit"]>().mockResolvedValue(undefined),
    cancel: vi.fn<InventoryGateway["cancel"]>().mockResolvedValue(undefined),
  } satisfies InventoryGateway;
  const payments = { execute: vi.fn().mockResolvedValue(undefined) };
  return {
    inventory,
    payments,
    processor: new ProcessOrderEventUseCase(orders, inventory, payments),
  };
}

describe("注文イベントの整合", () => {
  it("古い確定イベントでも現在キャンセル済みなら在庫を戻す", async () => {
    const cancelled = placed.cancel({ now: "2026-10-03", eventId: "cancelled" });
    const { processor, inventory, payments } = setup(cancelled);
    // 同じ古いイベントを再送する。ここでは再照合を検証し、在庫減算の冪等性はアダプター側で扱う。
    await processor.execute(ProcessOrderEventInputDto.parse({ event: placed.events[0]! }));
    await processor.execute(ProcessOrderEventInputDto.parse({ event: placed.events[0]! }));
    expect(inventory.cancel).toHaveBeenCalledTimes(2);
    expect(inventory.commit).not.toHaveBeenCalled();
    expect(payments.execute).toHaveBeenCalledWith(cancelled.toSnapshot());
  });
  it("在庫失敗時は決済に進まず、呼び出し元へ再試行を求める", async () => {
    const { processor, inventory, payments } = setup(placed);
    inventory.commit.mockRejectedValue(new Error("DB障害"));
    await expect(
      processor.execute(ProcessOrderEventInputDto.parse({ event: placed.events[0]! })),
    ).rejects.toThrow("DB障害");
    expect(payments.execute).not.toHaveBeenCalled();
  });
});
