import { z } from "zod";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import { InvalidInventoryError } from "#api/domain/inventory/errors/invalid-inventory-error.ts";
import { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import { persistedText } from "#api/infrastructure/shared/mappers/persisted-values.ts";

const schema = z.object({
  sku: z.unknown().transform(Sku.create),
  onHand: z.unknown().transform(StockQuantity.create),
  reservations: z.array(
    z.object({
      orderId: persistedText,
      quantity: z.unknown().transform(ReservationQuantity.create),
    }),
  ),
});

// D1現在庫とDO予約の未検証値を、この境界で用途別Value Objectへ戻す。
export function restoreStoredInventory(value: unknown): InventoryItem {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvalidInventoryError("在庫の予約情報が不正です");
  }

  const { sku, onHand, reservations } = result.data;
  return InventoryItem.restore({
    sku,
    onHand,
    reservations: reservations.map((r) => StockReservationEntity.reserve({ ...r, sku })),
  });
}
