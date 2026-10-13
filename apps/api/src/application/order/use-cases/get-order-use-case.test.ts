import { OrderListItemDto } from "#api/application/order/dtos/order-output.ts";
import { GetOrderInputDto } from "#api/application/order/dtos/get-order-input-dto.ts";
import { expect, it, vi } from "vite-plus/test";
import { GetOrderUseCase } from "#api/application/order/use-cases/get-order-use-case.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { orderValues } from "#api/test/domain-values.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import { PaymentState } from "#api/domain/payment/entities/payment-state.ts";
import { OrderStatusEntity } from "#api/domain/order/entities/order-status.ts";

function setup() {
  const order = OrderEntity.draft(
    orderValues({
      id: "o1",
      tenantId: "a",
      customerId: "owner",
      lines: [{ sku: "s1", name: "Mug", quantity: 1, unitPrice: 0 }],
      now: "2026-10-02",
      eventId: "e1",
    }),
  );
  const find = vi.fn<OrderRepository["find"]>(async (tenant) => (tenant === "a" ? order : null));
  return new GetOrderUseCase(
    { find },
    {
      findForOrders: async () => [
        PaymentState.restore({
          id: "o1",
          tenantId: "a",
          orderId: "o1",
          orderVersion: 0,
          status: "pending",
        }),
      ],
    },
    { list: async () => [OrderStatusEntity.restore({ id: "draft", name: "下書き" })] },
  );
}

it("顧客の本人所有を検査し、企業には自社の注文を返す", async () => {
  const useCase = setup();
  const base = {
    userId: "owner",
    tenantId: "a",
    role: "member" as const,
    permissions: ["order:read" as const],
  };
  expect((await useCase.execute(await orderInput({ ...base, channel: "customer" }))).id).toBe("o1");
  expect(
    OrderListItemDto.parse(
      await useCase.execute(await orderInput({ ...base, channel: "business" })),
    ),
  ).toMatchObject({ paymentStatus: "pending", statusLabel: "下書き" });
  await expect(
    useCase.execute(await orderInput({ ...base, channel: "customer", userId: "other" })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(
    (await useCase.execute(await orderInput({ ...base, channel: "business", userId: "staff" }))).id,
  ).toBe("o1");
  await expect(
    useCase.execute(await orderInput({ ...base, tenantId: "b", channel: "business" })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

async function orderInput(identity: Parameters<typeof authorizedActor>[0]) {
  return GetOrderInputDto.parse({ actor: await authorizedActor(identity), id: "o1" });
}
