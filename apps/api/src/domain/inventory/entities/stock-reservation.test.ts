import { inventoryValues, reservationValues } from "#api/test/domain-values.ts";
import type { InventorySnapshot } from "#api/domain/inventory/entities/inventory-item.ts";
import type { ReservationSnapshot } from "#api/domain/inventory/entities/stock-reservation.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { describe, expect, it } from "vite-plus/test";
import { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import { InvalidReservationTransitionError } from "#api/domain/inventory/errors/invalid-reservation-transition-error.ts";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import { InvalidInventoryError } from "#api/domain/inventory/errors/invalid-inventory-error.ts";

const input = { sku: "s1", orderId: "r1", quantity: 2 };
describe("在庫予約エンティティ（StockReservationEntity）", () => {
  it("予約を確定・復元し、終了後の操作を型と実行時で拒否する", () => {
    const reserved = StockReservationEntity.reserve(reservationValues(input));
    const committed = reserved.commit();
    const restored = committed.restoreStock();
    expect(reserved.status).toBe("reserved");
    expect(restored.status).toBe("restored");

    expect(() => invokeRuntime(committed, "release", [])).toThrow(
      InvalidReservationTransitionError,
    );

    expect(() => invokeRuntime(restored, "restoreStock", [])).toThrow(
      InvalidReservationTransitionError,
    );
  });
  it("解放した予約を再度確定できない", () => {
    const released = StockReservationEntity.reserve(reservationValues(input)).release();

    expect(() => invokeRuntime(released, "commit", [])).toThrow(InvalidReservationTransitionError);
  });

  it("別SKUの予約で現在庫を減らせない", () => {
    const inventory = restoreInventoryFixture({
      sku: "s1",
      onHand: 5,
      reservations: [{ orderId: "r1", quantity: 2 }],
    });
    const wrongSku = StockReservationEntity.reserve(reservationValues({ ...input, sku: "s2" }));
    expect(() =>
      inventory.commitReservation({ reservation: wrongSku, now: "2026-10-02", eventId: "e1" }),
    ).toThrow(InvalidInventoryError);
  });
  it("既に消費した古い予約エンティティでも、集約が二重の減算を拒否する", () => {
    const current = restoreInventoryFixture({
      sku: "s1",
      onHand: 5,
      reservations: [{ orderId: "r1", quantity: 2 }],
    });
    const reserved = current.findReservation("r1");
    if (!reserved) {
      throw new Error("予約がありません");
    }

    const committed = current.commitReservation({
      reservation: reserved,
      now: "2026-10-02",
      eventId: "e1",
    });
    expect(() =>
      committed.commitReservation({ reservation: reserved, now: "2026-10-02", eventId: "e2" }),
    ).toThrow(InvalidInventoryError);
  });
});

// 状態型で呼べない遷移も列挙し、JavaScript境界からの呼出しを実行時ガードが拒否するか調べる。
function uncheckedReservationAction(
  reservation: import("#api/domain/inventory/entities/stock-reservation.ts").StockReservation,
  target: "committed" | "released" | "restored",
) {
  switch (target) {
    case "committed":
      return invokeRuntime(reservation, "commit", []);
    case "released":
      return invokeRuntime(reservation, "release", []);
    case "restored":
      return invokeRuntime(reservation, "restoreStock", []);
  }
}

const reservationStates = ["reserved", "committed", "released", "restored"] as const;
const reservationTargets = ["committed", "released", "restored"] as const;
const allowedReservationEdges = new Set([
  "reserved:committed",
  "reserved:released",
  "committed:restored",
]);
it.each(
  reservationStates.flatMap((source) =>
    reservationTargets.map((target) => [source, target] as const),
  ),
)("在庫予約の全遷移 %s → %s を検証する", (source, target) => {
  const reservation = restoreReservationFixture({ ...input, status: source });
  if (allowedReservationEdges.has(`${source}:${target}`)) {
    expect(uncheckedReservationAction(reservation, target)).toMatchObject({ status: target });
  } else {
    expect(() => uncheckedReservationAction(reservation, target)).toThrow(
      InvalidReservationTransitionError,
    );
  }
});

function restoreReservationFixture(value: ReservationSnapshot) {
  return StockReservationEntity.restore(reservationValues(value));
}

function restoreInventoryFixture(value: InventorySnapshot) {
  return InventoryItem.restore(inventoryValues(value));
}
