import { stockChangeSchema } from "#api/infrastructure/inventory/durable-objects/inventory-input.ts";
import type { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import type { InventoryRepository } from "#api/domain/inventory/repositories/inventory-repository.ts";

/** 旧内部APIの互換処理。企業画面の変更は履歴付きadjust-stockを使う。 */
export async function changeStock(
  request: Request,
  store: InventoryRepository,
  load: (sku: string) => Promise<InventoryItem>,
) {
  const input = stockChangeSchema.parse(await request.json());
  const current = await load(input.sku);
  if (input.expectedStock !== undefined && input.expectedStock !== current.onHand) {
    return Response.json({ reason: "STOCK_CHANGED" }, { status: 409 });
  }

  if (input.quantity < current.reserved) {
    return Response.json({ reason: "STOCK_RESERVED" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const item = current.changeStock({
    onHand: StockQuantity.create(input.quantity),
    now,
    eventId: crypto.randomUUID(),
  });
  await store.save(item);
  return Response.json({
    sku: item.sku,
    stock: item.onHand,
    reserved: item.reserved,
    available: item.available,
    reservations: Object.fromEntries(
      item.reservations.map((reservation) => [reservation.orderId, reservation.quantity]),
    ),
  });
}
