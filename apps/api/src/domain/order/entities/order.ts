import { InvalidOrderError } from "#api/domain/order/errors/invalid-order-error.ts";
import { InvalidOrderTransitionError } from "#api/domain/order/errors/invalid-order-transition-error.ts";
import type { DomainEvent } from "#api/domain/order/events/domain-event.ts";
import { isNonEmptyString, isTimestamp } from "#api/domain/shared/validation.ts";

import type { OrderStatus } from "#api/domain/order/policies/order-status.ts";
import type { OrderLine, OrderLineSnapshot } from "#api/domain/order/entities/order-line.ts";

export type { OrderStatus } from "#api/domain/order/policies/order-status.ts";
export type { OrderLine, OrderLineSnapshot } from "#api/domain/order/entities/order-line.ts";

type OrderPayload = {
  reservationId: string | null;
  tenantId: string;
  customerId: string;
  total: number;
  lines: OrderLineSnapshot[];
};

export type OrderPlaced = DomainEvent<"order.placed", OrderPayload>;

export const ORDER_EVENT_NAMES = [
  "order.drafted",
  "order.updated",
  "order.placed",
  "order.cancelled",
  "order.shipped",
  "order.completed",
] as const;

export type OrderEvent = DomainEvent<(typeof ORDER_EVENT_NAMES)[number], OrderPayload>;

export type OrderSnapshot<S extends OrderStatus = OrderStatus> = Readonly<{
  id: string;
  tenantId: string;
  customerId: string;
  status: S;
  lines: OrderLineSnapshot[];
  total: number;
  createdAt: string;
  version: number;
  reservationId: string | null;
}>;

type OrderData<S extends OrderStatus = OrderStatus> = Omit<OrderSnapshot<S>, "lines"> & {
  lines: readonly OrderLine[];
};

export type Order = { [S in OrderStatus]: OrderEntity<S> }[OrderStatus];

export type OrderRestoration = Readonly<OrderData>;

type OrderCreation = {
  id: string;
  tenantId: string;
  customerId: string;
  lines: readonly OrderLine[];
  now: string;
  eventId: string;
};

type Change = { now: string; eventId: string };

export const ORDER_LINE_LIMITS = Object.freeze({ minCount: 1, maxCount: 20 });

function validateLines(lines: readonly OrderLine[]): readonly OrderLine[] {
  if (lines.length < ORDER_LINE_LIMITS.minCount || lines.length > ORDER_LINE_LIMITS.maxCount) {
    throw new InvalidOrderError(
      `注文明細は${ORDER_LINE_LIMITS.minCount}件以上${ORDER_LINE_LIMITS.maxCount}件以下にしてください`,
    );
  }

  const skus = new Set<string>();
  return Object.freeze(
    lines.map((line) => {
      if (skus.has(line.sku)) {
        throw new InvalidOrderError("同じSKUの明細は一つにまとめてください");
      }

      skus.add(line.sku);
      return line;
    }),
  );
}

// 保存形式・単一値の検証はアダプターが担当し、ここでは明細合計と状態の関係を検証する。
function validateRestoration(value: OrderRestoration): OrderData {
  const lines = validateLines(value.lines);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (value.total !== total) {
    throw new InvalidOrderError("注文の合計金額・更新番号が不正です");
  }

  if (value.status === "draft" && value.reservationId !== null) {
    throw new InvalidOrderError("下書きに在庫予約を設定できません");
  }

  if (value.status !== "draft" && value.status !== "cancelled" && value.reservationId === null) {
    throw new InvalidOrderError("確定済み注文には在庫予約IDが必要です");
  }

  return {
    id: value.id,
    tenantId: value.tenantId,
    customerId: value.customerId,
    status: value.status,
    lines,
    total,
    createdAt: value.createdAt,
    version: value.version,
    reservationId: value.reservationId,
  };
}

function validateChange(event: Change) {
  if (!isNonEmptyString(event.eventId) || !isTimestamp(event.now)) {
    throw new InvalidOrderError("注文イベントのID・日時が不正です");
  }
}

/** 状態遷移は新しい注文を返す。eventsには今回の変更だけを保持し、復元時は空にする。 */
export class OrderEntity<S extends OrderStatus> {
  // 状態を型でも区別する。JavaScriptからの呼出しに備え、各操作の実行時ガードも残す。
  declare private readonly stateBrand: S;
  readonly id: string;
  readonly status: S;
  readonly events: readonly OrderEvent[];

  private constructor(
    private readonly snapshot: OrderData<S>,
    events: readonly OrderEvent[],
  ) {
    this.id = snapshot.id;
    this.status = snapshot.status;
    this.snapshot = Object.freeze(snapshot);
    this.events = Object.freeze(events);
    Object.freeze(this);
  }

  get lines(): readonly OrderLine[] {
    return this.snapshot.lines;
  }

  get version() {
    return this.snapshot.version;
  }

  get reservationId() {
    return this.snapshot.reservationId;
  }

  get total() {
    return this.snapshot.total;
  }

  static draft(input: OrderCreation): OrderEntity<"draft"> {
    return OrderEntity.create(input, "draft");
  }

  static place(input: OrderCreation): OrderEntity<"confirmed"> {
    return OrderEntity.create(input, "confirmed");
  }

  private static create<T extends "draft" | "confirmed">(
    input: OrderCreation,
    status: T,
  ): OrderEntity<T> {
    const lines = validateLines(input.lines);
    const snapshot: OrderData<T> = {
      id: input.id,
      tenantId: input.tenantId,
      customerId: input.customerId,
      status,
      lines,
      total: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
      createdAt: input.now,
      version: 0,
      // 直接確定する新規注文は注文IDを予約IDに使い、下書きは在庫を確保しない。
      reservationId: status === "draft" ? null : input.id,
    };
    if (
      !isNonEmptyString(input.id) ||
      !isNonEmptyString(input.tenantId) ||
      !isNonEmptyString(input.customerId) ||
      !isTimestamp(input.now)
    ) {
      throw new InvalidOrderError("注文の識別情報・日時が不正です");
    }

    return OrderEntity.withEvent(
      snapshot,
      status === "draft" ? "order.drafted" : "order.placed",
      input,
    );
  }

  static restore(value: OrderRestoration): Order {
    const snapshot = validateRestoration(value);
    switch (snapshot.status) {
      case "draft":
        return new OrderEntity({ ...snapshot, status: "draft" }, []);
      case "confirmed":
        return new OrderEntity({ ...snapshot, status: "confirmed" }, []);
      case "shipped":
        return new OrderEntity({ ...snapshot, status: "shipped" }, []);
      case "completed":
        return new OrderEntity({ ...snapshot, status: "completed" }, []);
      case "cancelled":
        return new OrderEntity({ ...snapshot, status: "cancelled" }, []);
    }
  }

  update(
    this: OrderEntity<"draft">,
    value: readonly OrderLine[],
    event: Change,
  ): OrderEntity<"draft"> {
    if (this.status !== "draft") {
      throw new InvalidOrderTransitionError("明細を変更できるのは下書きの注文だけです");
    }

    const lines = validateLines(value);
    return OrderEntity.withEvent(
      {
        ...this.snapshot,
        lines,
        total: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
        version: this.snapshot.version + 1,
      },
      "order.updated",
      event,
    );
  }

  confirm(
    this: OrderEntity<"draft">,
    event: Change & { reservationId?: string },
    pricedLines: readonly OrderLine[] = this.lines,
  ): OrderEntity<"confirmed"> {
    if (this.status !== "draft") {
      throw new InvalidOrderTransitionError("下書きの注文だけを確定できます");
    }

    const lines = validateLines(pricedLines);
    // 下書きの確定では試行ごとの予約IDを使い、競合した別の確定処理の予約と区別する。
    const reservationId = event.reservationId ?? event.eventId;
    if (!isNonEmptyString(reservationId)) {
      throw new InvalidOrderError("在庫予約IDを指定してください");
    }

    return OrderEntity.withEvent(
      {
        ...this.snapshot,
        status: "confirmed",
        lines,
        total: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
        reservationId,
        version: this.snapshot.version + 1,
      },
      "order.placed",
      event,
    );
  }

  ship(this: OrderEntity<"confirmed">, event: Change): OrderEntity<"shipped"> {
    if (this.status !== "confirmed") {
      throw new InvalidOrderTransitionError("確定済みの注文だけを出荷できます");
    }

    return OrderEntity.withEvent(
      { ...this.snapshot, status: "shipped", version: this.snapshot.version + 1 },
      "order.shipped",
      event,
    );
  }

  complete(this: OrderEntity<"shipped">, event: Change): OrderEntity<"completed"> {
    if (this.status !== "shipped") {
      throw new InvalidOrderTransitionError("出荷済みの注文だけを完了できます");
    }

    return OrderEntity.withEvent(
      { ...this.snapshot, status: "completed", version: this.snapshot.version + 1 },
      "order.completed",
      event,
    );
  }

  cancel(
    this: OrderEntity<"draft"> | OrderEntity<"confirmed">,
    event: Change,
  ): OrderEntity<"cancelled"> {
    if (this.status !== "draft" && this.status !== "confirmed") {
      throw new InvalidOrderTransitionError("出荷前の注文だけをキャンセルできます");
    }

    return OrderEntity.withEvent(
      { ...this.snapshot, status: "cancelled", version: this.snapshot.version + 1 },
      "order.cancelled",
      event,
    );
  }

  private static withEvent<T extends OrderStatus>(
    snapshot: OrderData<T>,
    name: OrderEvent["name"],
    event: Change,
  ): OrderEntity<T> {
    validateChange(event);
    return new OrderEntity(snapshot, [
      {
        id: event.eventId,
        name,
        aggregateId: snapshot.id,
        occurredAt: event.now,
        payload: {
          reservationId: snapshot.reservationId,
          tenantId: snapshot.tenantId,
          customerId: snapshot.customerId,
          total: snapshot.total,
          lines: snapshot.lines.map((line) => line.toSnapshot()),
        },
      },
    ]);
  }

  toSnapshot(): OrderSnapshot<S> {
    return { ...this.snapshot, lines: this.snapshot.lines.map((line) => line.toSnapshot()) };
  }
}
