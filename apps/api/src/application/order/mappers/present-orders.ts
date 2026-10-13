import type { Order } from "#api/domain/order/entities/order.ts";
import type { PaymentStateRepository } from "#api/domain/payment/repositories/payment-state-repository.ts";
import type { OrderStatusRepository } from "#api/domain/order/repositories/order-status-repository.ts";
import { OrderListItemDto } from "#api/application/order/dtos/order-output.ts";

/** 表示用の結合はUseCaseの出力境界で行い、RepositoryからDTOを受け取らない。 */
export async function presentOrders(
  orders: readonly Order[],
  payments: PaymentStateRepository,
  statuses: OrderStatusRepository,
): Promise<OrderListItemDto[]> {
  if (!orders.length) {
    return [];
  }

  const snapshots = orders.map((order) => order.toSnapshot());
  const [definitions, states] = await Promise.all([
    statuses.list(),
    payments.findForOrders(snapshots.map((order) => ({ tenantId: order.tenantId, id: order.id }))),
  ]);
  const labels = new Map(definitions.map((status) => [status.id, status.name]));
  const byOrder = new Map(states.map((payment) => [payment.orderId, payment]));
  return snapshots
    .map((order) => {
      const payment = byOrder.get(order.id);
      // 注文取得後に同期が進んでも、読んだ注文より未来の決済版を表示しない。
      return {
        ...order,
        statusLabel: labels.get(order.status),
        paymentStatus: payment && payment.orderVersion <= order.version ? payment.status : null,
      };
    })
    .map((item) => OrderListItemDto.parse(item));
}
