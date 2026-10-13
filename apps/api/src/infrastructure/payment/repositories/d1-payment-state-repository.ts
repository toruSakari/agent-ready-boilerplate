import { drizzle } from "drizzle-orm/d1";
import { and, eq, or } from "drizzle-orm";
import { payments } from "#api/infrastructure/payment/schemas/schema.ts";
import { PaymentState } from "#api/domain/payment/entities/payment-state.ts";
import type { PaymentStateRepository } from "#api/domain/payment/repositories/payment-state-repository.ts";

const ORDERS_PER_STATEMENT = 50; // D1の100個のバインド上限内で企業・注文の組を照合する。

export class D1PaymentStateRepository implements PaymentStateRepository {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async findForOrders(orders: readonly { tenantId: string; id: string }[]) {
    if (!orders.length) {
      return [];
    }

    const select = (chunk: readonly { tenantId: string; id: string }[]) =>
      this.db
        .select({
          id: payments.id,
          tenantId: payments.tenantId,
          orderId: payments.orderId,
          orderVersion: payments.orderVersion,
          status: payments.status,
        })
        .from(payments)
        .where(
          or(
            ...chunk.map((order) =>
              and(eq(payments.tenantId, order.tenantId), eq(payments.orderId, order.id)),
            ),
          ),
        );
    const statements = [];
    for (let offset = 0; offset < orders.length; offset += ORDERS_PER_STATEMENT) {
      statements.push(select(orders.slice(offset, offset + ORDERS_PER_STATEMENT)));
    }

    const first = statements.shift()!;
    return (await this.db.batch([first, ...statements])).flat().map(PaymentState.restore);
  }
}
