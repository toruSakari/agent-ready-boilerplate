import { Product } from "#api/domain/product/entities/product.ts";

import { restoreStoredOrderLine } from "#api/infrastructure/order/mappers/restore-stored-order-line.ts";
import type { OrderLineSnapshot } from "#api/domain/order/entities/order-line.ts";
import { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";

import type { InventorySnapshot } from "#api/domain/inventory/entities/inventory-item.ts";
import { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";

// テストでもブランド型をアサーションで偽造せず、本番と同じ生成・復元処理を通す。
export function orderValues<T extends { lines: readonly OrderLineSnapshot[] }>(input: T) {
  return { ...input, lines: input.lines.map(restoreStoredOrderLine) };
}

export function paymentValues<T extends { amount: number; currency: string }>(input: T) {
  return {
    ...input,
    amount: PaymentAmount.create(input.amount),
    currency: CurrencyCode.create(input.currency),
  };
}

export function reservationValues<T extends { sku: string; quantity: number }>(input: T) {
  return {
    ...input,
    sku: Sku.create(input.sku),
    quantity: ReservationQuantity.create(input.quantity),
  };
}

export function inventoryValues(input: InventorySnapshot) {
  const sku = Sku.create(input.sku);
  return {
    sku,
    onHand: StockQuantity.create(input.onHand),
    reservations: input.reservations.map((r) =>
      StockReservationEntity.reserve({ ...reservationValues({ ...r, sku }), sku }),
    ),
  };
}

export function productValues<T extends { sku: string; name: string; unitPrice: number }>(
  input: T,
) {
  return {
    ...input,
    sku: Sku.create(input.sku),
    name: ProductName.create(input.name),
    unitPrice: UnitPrice.create(input.unitPrice),
  };
}

/** Repositoryのfixtureも、部分的な商品行ではなく復元済みEntityを返す。 */
export function productEntity(input: { sku: string; name: string; unitPrice: number }) {
  return Product.restore(
    productValues({
      ...input,
      id: input.sku,
      tenantId: "store-1",
      imageKey: null,
      images: [],
      createdAt: "2026-10-01",
    }),
  );
}
