import { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { OrderQuantity } from "#api/domain/order/value-objects/order-quantity.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
// コンパイル時だけの契約検査。本番コードからはインポートしない。
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import type { Order } from "#api/domain/order/entities/order.ts";
import { PaymentEntity } from "#api/domain/payment/entities/payment.ts";
import type { Payment } from "#api/domain/payment/entities/payment.ts";
import { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import type { StockReservation } from "#api/domain/inventory/entities/stock-reservation.ts";

export function verifyStateTypes(
  draft: OrderEntity<"draft">,
  pending: PaymentEntity<"pending">,
  reserved: StockReservationEntity<"reserved">,
  unknownOrder: Order,
  unknownPayment: Payment,
  unknownReservation: StockReservation,
) {
  const event = { now: "2026-10-02", eventId: "event-1" };
  const confirmed: OrderEntity<"confirmed"> = draft.confirm(event);
  const shipped: OrderEntity<"shipped"> = confirmed.ship(event);
  const completed: OrderEntity<"completed"> = shipped.complete(event);
  const cancelled: OrderEntity<"cancelled"> = confirmed.cancel(event);
  if (unknownOrder.status === "draft") {
    unknownOrder.confirm(event);
  }

  const authorized: PaymentEntity<"authorized"> = pending.authorize({
    ...event,
    authorizationId: "auth-1",
  });
  const captured: PaymentEntity<"captured"> = authorized.capture(event);
  const voided: PaymentEntity<"voided"> = authorized.void(event);
  const failed: PaymentEntity<"failed"> = pending.fail({ ...event, reason: "拒否" });
  if (unknownPayment.status === "authorized") {
    unknownPayment.capture(event);
  }

  const committed: StockReservationEntity<"committed"> = reserved.commit();
  const released: StockReservationEntity<"released"> = reserved.release();
  const restored: StockReservationEntity<"restored"> = committed.restoreStock();
  if (unknownReservation.status === "committed") {
    unknownReservation.restoreStock();
  }

  return {
    confirmed,
    shipped,
    completed,
    cancelled,
    authorized,
    captured,
    voided,
    failed,
    committed,
    released,
    restored,
  };
}

// 不正な呼出しやエラー抑制を記述せず、thisの受け手の型で禁止遷移を検査する。
type Assert<T extends true> = T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type CanCall<Receiver, Method> = [Receiver] extends [ThisParameterType<Method>] ? true : false;

export type OrderStateContracts = [
  Assert<Equal<CanCall<OrderEntity<"draft">, Order["update"]>, true>>,
  Assert<Equal<CanCall<OrderEntity<"confirmed">, Order["update"]>, false>>,
  Assert<Equal<CanCall<OrderEntity<"completed">, Order["cancel"]>, false>>,
  Assert<Equal<CanCall<OrderEntity<"shipped">, Order["cancel"]>, false>>,
  Assert<Equal<CanCall<OrderEntity<"cancelled">, Order["confirm"]>, false>>,
  Assert<Equal<CanCall<Order, Order["confirm"]>, false>>,
];

export type PaymentStateContracts = [
  Assert<Equal<CanCall<PaymentEntity<"pending">, Payment["capture"]>, false>>,
  Assert<Equal<CanCall<PaymentEntity<"authorized">, Payment["capture"]>, true>>,
  Assert<Equal<CanCall<PaymentEntity<"captured">, Payment["void"]>, false>>,
  Assert<Equal<CanCall<PaymentEntity<"voided">, Payment["authorize"]>, false>>,
  Assert<Equal<CanCall<PaymentEntity<"failed">, Payment["capture"]>, false>>,
  Assert<Equal<CanCall<Payment, Payment["capture"]>, false>>,
];

export type StockReservationStateContracts = [
  Assert<Equal<CanCall<StockReservationEntity<"reserved">, StockReservation["commit"]>, true>>,
  Assert<Equal<CanCall<StockReservationEntity<"committed">, StockReservation["release"]>, false>>,
  Assert<Equal<CanCall<StockReservationEntity<"released">, StockReservation["commit"]>, false>>,
  Assert<
    Equal<CanCall<StockReservationEntity<"restored">, StockReservation["restoreStock"]>, false>
  >,
  Assert<
    Equal<CanCall<StockReservationEntity<"reserved">, StockReservation["restoreStock"]>, false>
  >,
  Assert<Equal<CanCall<StockReservation, StockReservation["commit"]>, false>>,
];

export type EntityEncapsulationContracts = [
  Assert<Equal<OrderEntity<"confirmed"> extends OrderEntity<"draft"> ? true : false, false>>,
  Assert<
    Equal<
      typeof OrderEntity extends abstract new (...args: never[]) => unknown ? true : false,
      false
    >
  >,
  Assert<
    Equal<
      typeof PaymentEntity extends abstract new (...args: never[]) => unknown ? true : false,
      false
    >
  >,
  Assert<
    Equal<
      typeof StockReservationEntity extends abstract new (...args: never[]) => unknown
        ? true
        : false,
      false
    >
  >,
];

export type ValueObjectInputContracts = [
  Assert<Equal<Parameters<typeof PaymentEntity.initiate>[0]["amount"], PaymentAmount>>,
  Assert<Equal<Parameters<typeof PaymentEntity.initiate>[0]["currency"], CurrencyCode>>,
  Assert<Equal<string extends Sku ? true : false, false>>,
  Assert<Equal<number extends UnitPrice ? true : false, false>>,
  Assert<Equal<OrderQuantity extends ReservationQuantity ? true : false, false>>,
  Assert<
    Equal<Parameters<typeof OrderEntity.draft>[0]["lines"][number]["quantity"], OrderQuantity>
  >,
  Assert<
    Equal<Parameters<typeof StockReservationEntity.reserve>[0]["quantity"], ReservationQuantity>
  >,
];

function increment(quantity: OrderQuantity) {
  return quantity + 1;
}

export type PrimitiveBrandContracts = [
  Assert<Equal<ReturnType<typeof increment>, number>>,
  Assert<Equal<ReturnType<typeof increment> extends OrderQuantity ? true : false, false>>,
  Assert<Equal<OrderQuantity extends number ? true : false, true>>,
  Assert<Equal<Sku extends string ? true : false, true>>,
];

export type RestorationValueContracts = [
  Assert<
    Equal<Parameters<typeof OrderEntity.restore>[0]["lines"][number]["quantity"], OrderQuantity>
  >,
  Assert<Equal<Parameters<typeof PaymentEntity.restore>[0]["amount"], PaymentAmount>>,
  Assert<Equal<Parameters<typeof PaymentEntity.restore>[0]["currency"], CurrencyCode>>,
  Assert<Equal<Parameters<typeof StockReservationEntity.restore>[0]["sku"], Sku>>,
  Assert<
    Equal<Parameters<typeof StockReservationEntity.restore>[0]["quantity"], ReservationQuantity>
  >,
];
