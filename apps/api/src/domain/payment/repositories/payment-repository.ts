import type { Payment } from "#api/domain/payment/entities/payment.ts";

export interface PaymentRepository {
  /** 同じ企業・注文の版が進んだ場合だけ反映し、古い再配信で状態を巻き戻さない。 */
  save(payment: Payment, tenantId: string, orderVersion: number): Promise<void>;
}
