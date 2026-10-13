import { CreateOrderOutputDto } from "#api/application/order/dtos/create-order-output-dto.ts";
import type { CreateOrderInputDto } from "#api/application/order/dtos/create-order-input-dto.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { priceCustomerOrderLines } from "#api/application/order/policies/price-customer-order-lines.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import { defineLogEvent, logEvent } from "@dev-template/config/logging";
import { CreateOrderInput } from "#api/application/order/dtos/create-order-input.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { orderOperation } from "#api/application/order/errors/order-operation.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

const orderSaveUnknown = defineLogEvent(
  "order_save_unknown",
  "注文保存の結果を確認できません。在庫予約を保持します",
  ["orderId"],
);
const orderCreateCleanupFailed = defineLogEvent(
  "order_create_cleanup_failed",
  "注文作成失敗時の在庫予約解放に失敗しました",
  ["orderId"],
);

export class CreateOrderUseCase {
  constructor(
    private readonly orders: Pick<OrderRepository, "save" | "find" | "update">,
    private readonly inventory: InventoryGateway,
    private readonly products: Pick<ProductRepository, "findBySkus">,
  ) {}

  private async releaseFailedReservation(
    command: CreateOrderInput,
    orderId: string,
    reservedSkus: string[],
  ) {
    const cleanup = await Promise.allSettled(
      reservedSkus.map((sku) =>
        this.inventory.release({ tenantId: command.identity.tenantId, orderId, sku }),
      ),
    );
    if (cleanup.some((result) => result.status === "rejected")) {
      logEvent("error", orderCreateCleanupFailed, { orderId });
    }
  }

  private async prepareCommand(input: CreateOrderInput) {
    const command = { ...input };
    // 通販の注文所有者は一般ユーザーだけ。内部の別入口でも企業による代理注文を作らない。
    if (command.identity.channel !== "customer") {
      throw new ApplicationError({
        code: "FORBIDDEN",
        message: "一般ユーザーだけが注文を作成できます",
      });
    }

    const lines = await priceCustomerOrderLines(
      this.products,
      command.identity.tenantId,
      command.lines,
    );
    return { ...command, lines };
  }

  async execute(input: CreateOrderInputDto): Promise<CreateOrderOutputDto> {
    const command = await this.prepareCommand(CreateOrderInput.parse(input));
    const orderId = crypto.randomUUID();
    const reservedSkus: string[] = [];
    const creation = {
      id: orderId,
      tenantId: command.identity.tenantId,
      customerId: command.identity.userId,
      lines: command.lines,
      now: new Date().toISOString(),
      eventId: crypto.randomUUID(),
    };
    const order = orderOperation(() =>
      command.draft ? OrderEntity.draft(creation) : OrderEntity.place(creation),
    );
    try {
      for (const line of command.draft ? [] : command.lines) {
        // 予約成功後の応答消失も補償対象にできるよう、呼出し前に試行したSKUを記録する。
        reservedSkus.push(line.sku);
        await this.inventory.reserve({
          tenantId: command.identity.tenantId,
          orderId,
          sku: line.sku,
          quantity: line.quantity,
        });
      }

      await this.orders.save(order);
      return CreateOrderOutputDto.parse(order.toSnapshot());
    } catch (error) {
      // 保存後に応答だけ失われる場合がある。永続化の成否を確認するまで予約を解放しない。
      try {
        const persisted = await this.orders.find(command.identity.tenantId, orderId);
        if (persisted) {
          return CreateOrderOutputDto.parse(persisted.toSnapshot());
        }
      } catch {
        logEvent("error", orderSaveUnknown, { orderId });
        throw error;
      }

      // 未保存を確認できた場合だけ全試行分を解放し、一件の補償失敗で他の解放を止めない。
      await this.releaseFailedReservation(command, orderId, reservedSkus);
      throw error;
    }
  }
}
