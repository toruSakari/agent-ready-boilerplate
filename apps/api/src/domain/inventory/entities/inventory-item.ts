import { InvalidInventoryError } from "#api/domain/inventory/errors/invalid-inventory-error.ts";
import { InsufficientStockError } from "#api/domain/inventory/errors/insufficient-stock-error.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import type { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";

export type InventoryReservation = Readonly<{
  orderId: string;
  quantity: number;
}>;

export type InventorySnapshot = Readonly<{
  sku: string;
  onHand: number;
  reservations: readonly InventoryReservation[];
}>;

export type InventoryRestoration = Readonly<{
  sku: Sku;
  onHand: StockQuantity;
  reservations: readonly StockReservationEntity<"reserved">[];
}>;

export type InventoryReserved = Readonly<{
  id: string;
  name: "inventory.reserved";
  aggregateId: string;
  occurredAt: string;
  payload: InventoryReservation;
}>;

export type InventoryReservationReleased = Readonly<{
  id: string;
  name: "inventory.reservation-released";
  aggregateId: string;
  occurredAt: string;
  payload: InventoryReservation;
}>;

export type InventoryReservationCommitted = Readonly<{
  id: string;
  name: "inventory.reservation-committed";
  aggregateId: string;
  occurredAt: string;
  payload: InventoryReservation;
}>;

export type InventoryStockChanged = Readonly<{
  id: string;
  name: "inventory.stock-changed";
  aggregateId: string;
  occurredAt: string;
  payload: Readonly<{ previousOnHand: number; onHand: number }>;
}>;

export type InventoryEvent =
  | InventoryReserved
  | InventoryReservationReleased
  | InventoryReservationCommitted
  | InventoryStockChanged;

/** 一つのSKUの現在庫と有効な予約の整合性を扱う。永続化・直列化は呼出元が担う。 */
export class InventoryItem {
  readonly events: readonly InventoryEvent[];

  private constructor(
    readonly sku: Sku,
    readonly onHand: StockQuantity,
    readonly reservations: readonly StockReservationEntity<"reserved">[],
    events: readonly InventoryEvent[],
  ) {
    this.events = events;
    Object.freeze(this.reservations);
    Object.freeze(this);
  }

  static restore(value: InventoryRestoration): InventoryItem {
    const { sku, onHand } = value;
    const orderIds = new Set<string>();
    const reservations = value.reservations.map((reservation) => {
      if (reservation.sku !== sku || reservation.status !== "reserved") {
        throw new InvalidInventoryError("この在庫の有効な予約を指定してください");
      }

      if (orderIds.has(reservation.orderId)) {
        throw new InvalidInventoryError("同じ注文の予約を重複して登録できません");
      }

      orderIds.add(reservation.orderId);
      return reservation;
    });
    const item = new InventoryItem(sku, onHand, reservations, []);
    if (!Number.isSafeInteger(item.reserved) || item.reserved > item.onHand) {
      throw new InvalidInventoryError("予約数は在庫数を超えることができません");
    }

    return item;
  }

  get reserved(): number {
    return this.reservations.reduce((total, reservation) => total + reservation.quantity, 0);
  }

  get available(): number {
    return this.onHand - this.reserved;
  }

  findReservation(orderId: string): StockReservationEntity<"reserved"> | undefined {
    return this.reservations.find((reservation) => reservation.orderId === orderId);
  }

  reserve(input: {
    orderId: string;
    quantity: ReservationQuantity;
    now: string;
    eventId: string;
  }): InventoryItem {
    const reservation = StockReservationEntity.reserve({
      sku: this.sku,
      orderId: input.orderId,
      quantity: input.quantity,
    });
    const existing = this.findReservation(input.orderId);
    // 同じ注文・数量の再送は成功扱いにし、予約数やイベントを二重に増やさない。
    if (existing) {
      if (existing.quantity !== input.quantity) {
        throw new InvalidInventoryError("この注文には異なる内容の予約があります");
      }

      return this;
    }

    if (input.quantity > this.available) {
      throw new InsufficientStockError("在庫が不足しています");
    }

    return new InventoryItem(
      this.sku,
      this.onHand,
      [...this.reservations, reservation],
      [
        {
          id: input.eventId,
          name: "inventory.reserved",
          aggregateId: this.sku,
          occurredAt: input.now,
          payload: reservation.toReference(),
        },
      ],
    );
  }

  // 型が予約中でも消費済みの古いインスタンスは渡せるため、現在の集約内の予約と照合する。
  private requireReservation(reservation: StockReservationEntity<"reserved">) {
    const current = this.findReservation(reservation.orderId);
    if (
      reservation.status !== "reserved" ||
      reservation.sku !== this.sku ||
      !current ||
      current.quantity !== reservation.quantity
    ) {
      throw new InvalidInventoryError("この在庫の有効な予約を指定してください");
    }
  }

  release(input: {
    reservation: StockReservationEntity<"reserved">;
    now: string;
    eventId: string;
  }): InventoryItem {
    this.requireReservation(input.reservation);
    const released = input.reservation.release();
    return new InventoryItem(
      this.sku,
      this.onHand,
      this.reservations.filter((reservation) => reservation.orderId !== released.orderId),
      [
        {
          id: input.eventId,
          name: "inventory.reservation-released",
          aggregateId: this.sku,
          occurredAt: input.now,
          payload: released.toReference(),
        },
      ],
    );
  }

  commitReservation(input: {
    reservation: StockReservationEntity<"reserved">;
    now: string;
    eventId: string;
  }): InventoryItem {
    this.requireReservation(input.reservation);
    // 確定では現在庫の減算と予約の除去を同時に表し、利用可能数の二重減算を避ける。
    const committed = input.reservation.commit();
    return new InventoryItem(
      this.sku,
      StockQuantity.create(this.onHand - committed.quantity),
      this.reservations.filter((reservation) => reservation.orderId !== committed.orderId),
      [
        {
          id: input.eventId,
          name: "inventory.reservation-committed",
          aggregateId: this.sku,
          occurredAt: input.now,
          payload: committed.toReference(),
        },
      ],
    );
  }

  changeStock(input: { onHand: StockQuantity; now: string; eventId: string }): InventoryItem {
    const onHand = input.onHand;
    if (onHand < this.reserved) {
      throw new InvalidInventoryError("在庫数を予約数より少なくすることはできません");
    }

    return new InventoryItem(this.sku, onHand, this.reservations, [
      {
        id: input.eventId,
        name: "inventory.stock-changed",
        aggregateId: this.sku,
        occurredAt: input.now,
        payload: { previousOnHand: this.onHand, onHand: input.onHand },
      },
    ]);
  }

  toSnapshot(): InventorySnapshot {
    return {
      sku: this.sku,
      onHand: this.onHand,
      reservations: this.reservations.map((reservation) => reservation.toReference()),
    };
  }
}
