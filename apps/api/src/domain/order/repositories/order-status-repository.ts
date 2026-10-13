import type { OrderStatusEntity } from "#api/domain/order/entities/order-status.ts";

export interface OrderStatusRepository {
  list(): Promise<OrderStatusEntity[]>;
}
