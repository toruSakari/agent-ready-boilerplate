import { SynchronizePaymentInputDto } from "#api/application/payment/dtos/synchronize-payment-input-dto.ts";
import type { OrderPaymentSynchronizer } from "#api/application/order/gateways/payment-synchronizer.ts";
import type { SynchronizePaymentUseCase } from "#api/application/payment/use-cases/synchronize-payment-use-case.ts";
import type { SettlementOrder } from "#api/application/payment/dtos/synchronize-payment-input.ts";

/** 注文側の完了通知ポートと、決済UseCaseのDTO入出力を接続する。 */
export class OrderPaymentSynchronizationGateway implements OrderPaymentSynchronizer {
  constructor(private readonly useCase: SynchronizePaymentUseCase) {}

  async execute(input: SettlementOrder): Promise<void> {
    await this.useCase.execute(SynchronizePaymentInputDto.parse(input));
  }
}
