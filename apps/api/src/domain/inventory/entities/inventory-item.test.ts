import { inventoryValues } from "#api/test/domain-values.ts";
import type { InventorySnapshot } from "#api/domain/inventory/entities/inventory-item.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import { expect, it } from "vite-plus/test";
import { InsufficientStockError } from "#api/domain/inventory/errors/insufficient-stock-error.ts";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";

it("在庫エンティティ（InventoryItem） / 利用可能な在庫を予約してイベントを記録する", () => {
  const item = restoreInventoryFixture({ sku: "SKU-1", onHand: 5, reservations: [] }).reserve({
    orderId: "order-1",
    quantity: ReservationQuantity.create(2),
    now: "2026-09-30T00:00:00.000Z",
    eventId: "event-1",
  });

  expect(item.available).toBe(3);
  expect(item.events).toEqual([
    expect.objectContaining({
      name: "inventory.reserved",
      aggregateId: "SKU-1",
    }),
  ]);
});

it("在庫エンティティ（InventoryItem） / 利用可能な在庫を超える予約を拒否する", () => {
  const item = restoreInventoryFixture({ sku: "SKU-1", onHand: 1, reservations: [] });

  expect(() =>
    item.reserve({
      orderId: "order-1",
      quantity: ReservationQuantity.create(2),
      now: "2026-09-30T00:00:00.000Z",
      eventId: "event-1",
    }),
  ).toThrow(InsufficientStockError);
});

it("在庫エンティティ（InventoryItem） / 予約を確定して現在庫から差し引く", () => {
  const reserved = restoreInventoryFixture({
    sku: "SKU-1",
    onHand: 5,
    reservations: [{ orderId: "order-1", quantity: 2 }],
  });
  const reservation = reserved.findReservation("order-1");
  if (!reservation) {
    throw new Error("予約が作成されていません");
  }

  const item = reserved.commitReservation({
    reservation,
    now: "2026-09-30T00:00:00.000Z",
    eventId: "event-1",
  });

  expect(item.toSnapshot()).toEqual({
    sku: "SKU-1",
    onHand: 3,
    reservations: [],
  });
  expect(item.available).toBe(3);
  expect(item.events).toEqual([
    expect.objectContaining({
      name: "inventory.reservation-committed",
      aggregateId: "SKU-1",
      payload: { orderId: "order-1", quantity: 2 },
    }),
  ]);
});

it("予約数量はインスタンスではなく値で比較し、予約中の数量を下回る在庫変更を拒否する", () => {
  const current = restoreInventoryFixture({
    sku: "s1",
    onHand: 5,
    reservations: [{ orderId: "r1", quantity: 2 }],
  });
  expect(
    current.reserve({
      orderId: "r1",
      quantity: ReservationQuantity.create(2),
      now: "2026-10-02",
      eventId: "e1",
    }),
  ).toBe(current);
  expect(() =>
    current.changeStock({ onHand: StockQuantity.create(1), now: "2026-10-02", eventId: "e2" }),
  ).toThrow("在庫数を予約数より少なくすることはできません");
});

// 永続化アダプターの境界を模し、プリミティブのfixtureを検証済みの数量・予約へ変換して渡す。
function restoreInventoryFixture(value: InventorySnapshot) {
  return InventoryItem.restore(inventoryValues(value));
}
