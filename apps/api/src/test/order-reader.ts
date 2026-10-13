import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { D1PaymentStateRepository } from "#api/infrastructure/payment/repositories/d1-payment-state-repository.ts";
import { D1OrderStatusRepository } from "#api/infrastructure/order/repositories/d1-order-status-repository.ts";
import { presentOrders } from "#api/application/order/mappers/present-orders.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";

/** 結合テストでも本番と同じEntity取得とUseCaseの出力変換を検証する。 */
export function orderReader(binding: D1Database) {
  const orders = new D1OrderRepository(binding);
  const payments = new D1PaymentStateRepository(binding);
  const statuses = new D1OrderStatusRepository(binding);
  return {
    list: async (...args: Parameters<OrderRepository["list"]>) =>
      await presentOrders(await orders.list(...args), payments, statuses),
    get: async (tenantId: string, id: string) => {
      const order = await orders.find(tenantId, id);
      return order ? (await presentOrders([order], payments, statuses))[0]! : null;
    },
  };
}
