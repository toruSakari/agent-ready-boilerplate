import { ListOrdersOutputDto } from "#api/application/order/dtos/list-orders-output-dto.ts";
import type { ListOrdersInputDto } from "#api/application/order/dtos/list-orders-input-dto.ts";
import { pageRequest } from "#api/application/shared/pagination.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { PaymentStateRepository } from "#api/domain/payment/repositories/payment-state-repository.ts";
import type { OrderStatusRepository } from "#api/domain/order/repositories/order-status-repository.ts";
import { presentOrders } from "#api/application/order/mappers/present-orders.ts";

export class ListOrdersUseCase {
  constructor(
    private readonly orders: Pick<OrderRepository, "list">,
    private readonly payments: PaymentStateRepository,
    private readonly statuses: OrderStatusRepository,
  ) {}

  async execute(inputDto: ListOrdersInputDto): Promise<ListOrdersOutputDto> {
    const { identity, page, filters } = inputDto;
    // 顧客の所有判定には現在の会員IDを使い、同じsubjectの別サービス・再登録前の注文を含めない。
    const orders = await this.orders.list(
      identity.tenantId,
      identity.channel === "customer" ? identity.userId : undefined,
      pageRequest(page),
      filters,
    );
    return ListOrdersOutputDto.parse({
      items: await presentOrders(orders, this.payments, this.statuses),
    });
  }
}
