import { SynchronizePaymentOutputDto } from "#api/application/payment/dtos/synchronize-payment-output-dto.ts";
import type { SynchronizePaymentInputDto } from "#api/application/payment/dtos/synchronize-payment-input-dto.ts";
import { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";
import { PaymentEntity } from "#api/domain/payment/entities/payment.ts";
import type { PaymentRepository } from "#api/domain/payment/repositories/payment-repository.ts";

// 注文集約に依存せず値契約から決済状態を作るデモ方針。外部への実課金は行わない。
export class SynchronizePaymentUseCase {
  constructor(private readonly payments: PaymentRepository) {}

  async execute(input: SynchronizePaymentInputDto): Promise<SynchronizePaymentOutputDto> {
    if (input.status === "draft" || input.total === 0) {
      return SynchronizePaymentOutputDto.parse({ ok: true });
    }

    const event = { now: new Date().toISOString(), eventId: crypto.randomUUID() };
    // 最新の注文から目標状態を組み立て直し、保存時の注文versionで古い結果の反映を防ぐ。
    const pending = PaymentEntity.initiate({
      id: input.id,
      orderId: input.id,
      amount: PaymentAmount.create(input.total),
      currency: CurrencyCode.create("JPY"),
      now: input.createdAt,
      eventId: event.eventId,
    });
    const payment = (() => {
      switch (input.status) {
        case "cancelled":
          return pending.void(event);
        case "confirmed":
          return pending.authorize({ ...event, authorizationId: `demo:${input.id}` });
        case "shipped":
        case "completed":
          return pending
            .authorize({ ...event, authorizationId: `demo:${input.id}` })
            .capture(event);
        default:
          throw new Error("決済に対応する注文状態が不正です");
      }
    })();
    await this.payments.save(payment, input.tenantId, input.version);
    return SynchronizePaymentOutputDto.parse({ ok: true });
  }
}
