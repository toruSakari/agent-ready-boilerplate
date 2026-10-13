import { drizzle } from "drizzle-orm/d1";
import { and, eq, lt } from "drizzle-orm";
import type { PaymentRepository } from "#api/domain/payment/repositories/payment-repository.ts";
import type { Payment } from "#api/domain/payment/entities/payment.ts";
import { InvalidPaymentError } from "#api/domain/payment/errors/invalid-payment-error.ts";
import { payments } from "#api/infrastructure/payment/schemas/schema.ts";

export class D1PaymentRepository implements PaymentRepository {
  private readonly database;

  constructor(database: D1Database) {
    this.database = drizzle(database);
  }

  async save(entity: Payment, tenantId: string, orderVersion: number) {
    const payment = entity.toSnapshot();
    const values = {
      id: payment.id,
      tenantId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      authorizationId: payment.authorizationId ?? null,
      orderVersion,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
    // 所有関係と注文版を同じbatchで確認し、再送や衝突で別企業・別注文へ移さない。
    const [, identities] = await this.database.batch([
      this.database
        .insert(payments)
        .values(values)
        .onConflictDoUpdate({
          target: payments.id,
          set: values,
          setWhere: and(
            eq(payments.tenantId, tenantId),
            eq(payments.orderId, payment.orderId),
            lt(payments.orderVersion, orderVersion),
          ),
        }),
      this.database
        .select({ tenantId: payments.tenantId, orderId: payments.orderId })
        .from(payments)
        .where(eq(payments.id, payment.id))
        .limit(1),
    ]);
    const identity = identities[0];
    if (!identity || identity.tenantId !== tenantId || identity.orderId !== payment.orderId) {
      throw new InvalidPaymentError("決済の所有関係が一致しません");
    }
  }
}
