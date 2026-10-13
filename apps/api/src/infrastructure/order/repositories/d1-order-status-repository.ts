import { drizzle } from "drizzle-orm/d1";
import { orderStatuses } from "#api/infrastructure/order/schemas/schema.ts";
import { OrderStatusEntity } from "#api/domain/order/entities/order-status.ts";
import type { OrderStatusRepository } from "#api/domain/order/repositories/order-status-repository.ts";

export class D1OrderStatusRepository implements OrderStatusRepository {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async list() {
    return (
      await this.db.select({ id: orderStatuses.code, name: orderStatuses.name }).from(orderStatuses)
    ).map(OrderStatusEntity.restore);
  }
}
