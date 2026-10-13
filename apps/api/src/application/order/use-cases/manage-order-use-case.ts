import { manageOrderInputSchema } from "#api/application/order/dtos/manage-order-input.ts";
import { z } from "zod";
import { ManageOrderOutputDto } from "#api/application/order/dtos/manage-order-output-dto.ts";
import type { ManageOrderInputDto } from "#api/application/order/dtos/manage-order-input-dto.ts";
import { priceCustomerOrderLines } from "#api/application/order/policies/price-customer-order-lines.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import { defineLogEvent, logEvent } from "@dev-template/config/logging";
import { createOrderLine } from "#api/application/order/mappers/create-order-line.ts";
import type { OrderLine, OrderLineSnapshot } from "#api/domain/order/entities/order-line.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { InvalidOrderTransitionError } from "#api/domain/order/errors/invalid-order-transition-error.ts";
import type { OrderStatus, Order } from "#api/domain/order/entities/order.ts";
import { orderOperation } from "#api/application/order/errors/order-operation.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

const orderConfirmUnknown = defineLogEvent(
  "order_confirm_unknown",
  "注文確定の結果を確認できません。在庫予約を保持します",
  ["orderId", "reservationId"],
);
const orderConfirmCleanupFailed = defineLogEvent(
  "order_confirm_cleanup_failed",
  "注文確定失敗時の在庫予約解放に失敗しました",
  ["orderId", "reservationId"],
);

export class ManageOrderUseCase {
  constructor(
    private readonly orders: Pick<OrderRepository, "save" | "find" | "update">,
    private readonly inventory: InventoryGateway,
    private readonly products: Pick<ProductRepository, "findBySkus">,
  ) {}

  private async priceDraft(current: Order, command: z.input<typeof manageOrderInputSchema>) {
    // 顧客の下書きは編集・確定時に商品価格を照会し、確定した明細クラスを集約へ渡す。
    const customerDraft = command.identity.channel === "customer" && current.status === "draft";
    let lines: OrderLine[] | undefined;
    let confirmationLines: OrderLine[] | undefined;
    if (customerDraft && command.lines) {
      lines = await priceCustomerOrderLines(
        this.products,
        command.identity.tenantId,
        command.lines,
      );
    } else if (customerDraft && command.status === "confirmed") {
      confirmationLines = await priceCustomerOrderLines(
        this.products,
        command.identity.tenantId,
        current.toSnapshot().lines,
      );
    }

    return { lines, confirmationLines };
  }

  private async reserveConfirmation(
    command: z.input<typeof manageOrderInputSchema>,
    next: Order,
    eventId: string,
    reservedSkus: string[],
  ) {
    if (command.status === "confirmed") {
      for (const line of next.toSnapshot().lines) {
        // 在庫側で成功して応答だけ失われたSKUも、未保存なら解放対象へ含める。
        reservedSkus.push(line.sku);
        await this.inventory.reserve({
          tenantId: command.identity.tenantId,
          orderId: eventId,
          sku: line.sku,
          quantity: line.quantity,
        });
      }
    }
  }

  private async recoverFailedUpdate(
    command: z.input<typeof manageOrderInputSchema>,
    eventId: string,
    reservedSkus: string[],
    error: unknown,
  ) {
    if (reservedSkus.length > 0) {
      try {
        const persisted = await this.orders.find(command.identity.tenantId, command.id);
        // 注文の存在だけでなく今回の予約IDを照合し、この試行の保存成功かを判別する。
        if (persisted?.reservationId === eventId) {
          return persisted.toSnapshot();
        }
      } catch {
        logEvent("error", orderConfirmUnknown, {
          orderId: command.id,
          reservationId: eventId,
        });
        throw error;
      }
    }

    const cleanup = await Promise.allSettled(
      reservedSkus.map((sku) =>
        this.inventory.release({ tenantId: command.identity.tenantId, orderId: eventId, sku }),
      ),
    );
    if (cleanup.some((result) => result.status === "rejected")) {
      logEvent("error", orderConfirmCleanupFailed, {
        orderId: command.id,
        reservationId: eventId,
      });
    }

    throw error;
  }

  async execute(inputDto: ManageOrderInputDto): Promise<ManageOrderOutputDto> {
    const { input } = inputDto;
    const command = { ...input };
    const current = await this.orders.find(command.identity.tenantId, command.id);
    if (!current) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "注文が見つかりません" });
    }

    assertOrderChange(current, command);
    // 確定試行ごとに予約IDを分け、競合時に成功した別試行の予約を補償で消さない。
    const eventId = crypto.randomUUID();
    const event = {
      now: new Date().toISOString(),
      eventId,
      ...(command.status === "confirmed" ? { reservationId: eventId } : {}),
    };
    const { lines, confirmationLines } = await this.priceDraft(current, command);
    const next = orderOperation(() => nextOrder(current, command, event, confirmationLines, lines));
    const reservedSkus: string[] = [];
    try {
      await this.reserveConfirmation(command, next, eventId, reservedSkus);
      if (!(await this.orders.update(next, command.version))) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "注文が更新されています。再読み込みしてください",
        });
      }

      return ManageOrderOutputDto.parse(next.toSnapshot());
    } catch (error) {
      return ManageOrderOutputDto.parse(
        await this.recoverFailedUpdate(command, eventId, reservedSkus, error),
      );
    }
  }
}

/** 所有者・許可する操作・読取版を、在庫処理より先に検査する。 */
function assertOrderChange(current: Order, command: z.input<typeof manageOrderInputSchema>) {
  // 汎用権限を持つ顧客でも、本人所有と出荷・完了の業務制限はここで別に確認する。
  if (
    command.identity.channel === "customer" &&
    (current.toSnapshot().customerId !== command.identity.userId ||
      command.status === "shipped" ||
      command.status === "completed")
  ) {
    throw new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
  }

  if (current.version !== command.version) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "注文が更新されています。再読み込みしてください",
    });
  }
}

// statusで共用型を絞って具体的な遷移を呼び、汎用の状態書換えで型の制約を迂回しない。
function nextOrder(
  current: Order,
  command: {
    lines?: readonly OrderLineSnapshot[];
    status?: Exclude<OrderStatus, "draft">;
  },
  event: {
    now: string;
    eventId: string;
    reservationId?: string;
  },
  confirmationLines?: readonly OrderLine[],
  pricedLines?: readonly OrderLine[],
): Order {
  if (command.lines) {
    return editDraft(current, command.lines, event, pricedLines);
  }

  switch (command.status) {
    case "confirmed":
      if (current.status === "draft") {
        return current.confirm(event, confirmationLines);
      }

      break;
    case "cancelled":
      return cancelOrder(current, event);
    case "shipped":
      if (current.status === "confirmed") {
        return current.ship(event);
      }

      break;
    case "completed":
      if (current.status === "shipped") {
        return current.complete(event);
      }

      break;
  }

  throw new InvalidOrderTransitionError("この注文の状態からは変更できません");
}

function editDraft(
  current: Order,
  lines: readonly OrderLineSnapshot[],
  event: {
    now: string;
    eventId: string;
  },
  pricedLines?: readonly OrderLine[],
) {
  if (current.status === "draft") {
    return current.update(pricedLines ?? lines.map(createOrderLine), event);
  }

  throw new InvalidOrderTransitionError("明細を変更できるのは下書きの注文だけです");
}

function cancelOrder(
  current: Order,
  event: {
    now: string;
    eventId: string;
  },
) {
  if (current.status === "draft" || current.status === "confirmed") {
    return current.cancel(event);
  }

  throw new InvalidOrderTransitionError("この注文の状態からは変更できません");
}
