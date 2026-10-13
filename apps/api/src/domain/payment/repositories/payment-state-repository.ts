import type { PaymentState } from "#api/domain/payment/entities/payment-state.ts";

export interface PaymentStateRepository {
  findForOrders(orders: readonly { tenantId: string; id: string }[]): Promise<PaymentState[]>;
}
