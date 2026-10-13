import { expect, it, vi } from "vite-plus/test";
import { presentOrders } from "#api/application/order/mappers/present-orders.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { PaymentState } from "#api/domain/payment/entities/payment-state.ts";
import { OrderStatusEntity } from "#api/domain/order/entities/order-status.ts";
import { orderValues } from "#api/test/domain-values.ts";

it("注文表示 / 注文より未来の決済版は表示せず、取得条件には復元済み注文の企業を使う", async () => {
  const order = OrderEntity.draft(
    orderValues({
      id: "o1",
      tenantId: "shop",
      customerId: "buyer",
      lines: [{ sku: "mug", name: "商品", quantity: 1, unitPrice: 100 }],
      now: "2026-10-11",
      eventId: "draft",
    }),
  );
  const findForOrders = vi.fn(async () => [
    PaymentState.restore({
      id: "o1",
      tenantId: "shop",
      orderId: "o1",
      orderVersion: 1,
      status: "captured",
    }),
  ]);
  const result = await presentOrders(
    [order],
    { findForOrders },
    { list: async () => [OrderStatusEntity.restore({ id: "draft", name: "下書き" })] },
  );
  expect(findForOrders).toHaveBeenCalledWith([{ tenantId: "shop", id: "o1" }]);
  expect(result[0]).toMatchObject({
    status: "draft",
    statusLabel: "下書き",
    paymentStatus: null,
  });
});
