import { GetOrderOutputDto } from "#api/application/order/dtos/get-order-output-dto.ts";
import type { GetOrderInputDto } from "#api/application/order/dtos/get-order-input-dto.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { PaymentStateRepository } from "#api/domain/payment/repositories/payment-state-repository.ts";
import type { OrderStatusRepository } from "#api/domain/order/repositories/order-status-repository.ts";
import { presentOrders } from "#api/application/order/mappers/present-orders.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

export class GetOrderUseCase {
  constructor(
    private readonly orders: Pick<OrderRepository, "find">,
    private readonly payments: PaymentStateRepository,
    private readonly statuses: OrderStatusRepository,
  ) {}

  async execute(inputDto: GetOrderInputDto): Promise<GetOrderOutputDto> {
    const { actor, id } = inputDto;
    const order = await this.orders.find(actor.tenantId, id);
    // 他人の注文の存在も公開しない。企業は自社の注文だけを閲覧できる。
    if (
      !order ||
      (actor.channel === "customer" && order.toSnapshot().customerId !== actor.userId)
    ) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "注文が見つかりません" });
    }

    return GetOrderOutputDto.parse(
      (await presentOrders([order], this.payments, this.statuses))[0]!,
    );
  }
}
