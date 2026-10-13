import { z } from "zod";
import { persistedText } from "#api/infrastructure/shared/mappers/persisted-values.ts";
import { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import { InvalidReservationError } from "#api/domain/inventory/errors/invalid-reservation-error.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";

const schema = z.object({
  orderId: persistedText,
  sku: z.unknown().transform(Sku.create),
  quantity: z.unknown().transform(ReservationQuantity.create),
  status: z.enum(["reserved", "committed", "released", "restored"]),
});

// DB/DOに保存された状態名を信用せず、数量と状態を検証してからTypestateへ復元する。
export function restoreStoredReservation(value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvalidReservationError("在庫予約のID・状態が不正です");
  }

  return StockReservationEntity.restore(result.data);
}
