import { ProcessOrderEventOutputDto } from "#api/application/order/dtos/process-order-event-output-dto.ts";
import type { ProcessOrderEventInputDto } from "#api/application/order/dtos/process-order-event-input-dto.ts";
import type { OrderPaymentSynchronizer } from "#api/application/order/gateways/payment-synchronizer.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

export class ProcessOrderEventUseCase {
  constructor(
    private readonly orders: Pick<OrderRepository, "save" | "find" | "update">,
    private readonly inventory: InventoryGateway,
    private readonly payments: OrderPaymentSynchronizer,
  ) {}

  async execute(inputDto: ProcessOrderEventInputDto): Promise<ProcessOrderEventOutputDto> {
    const { event } = inputDto;
    const order = await this.orders.find(event.payload.tenantId, event.aggregateId);
    if (!order) {
      throw new Error("イベントに対応する注文が見つかりません");
    }

    const current = order.toSnapshot();
    // Queueの遅延・順序逆転・再配信に備え、古いpayloadではなく現在の注文状態へ整合させる。
    if (current.reservationId) {
      for (const line of current.lines) {
        const input = { tenantId: current.tenantId, orderId: current.reservationId, sku: line.sku };
        if (current.status === "cancelled") {
          await this.inventory.cancel(input);
        } else if (current.status !== "draft") {
          await this.inventory.commit(input);
        }
      }
    }

    // 在庫処理の完了後にだけ決済を合わせる。途中失敗は呼出元へ返し、再配信で再試行する。
    if (current.reservationId) {
      await this.payments.execute(current);
    }

    return ProcessOrderEventOutputDto.parse({ ok: true });
  }
}
