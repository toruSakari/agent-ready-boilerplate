import type { Sku } from "#api/domain/shared/value-objects/sku.ts";
import type { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import type { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import type { OrderQuantity } from "#api/domain/order/value-objects/order-quantity.ts";

export type OrderLineSnapshot = Readonly<{
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}>;

/** 購入時点の商品情報。商品マスターが後から変わっても注文の名称・価格は変えない。 */
export class OrderLine {
  constructor(
    readonly sku: Sku,
    readonly name: ProductName,
    readonly quantity: OrderQuantity,
    readonly unitPrice: UnitPrice,
  ) {
    Object.freeze(this);
  }

  toSnapshot(): OrderLineSnapshot {
    return { sku: this.sku, name: this.name, quantity: this.quantity, unitPrice: this.unitPrice };
  }
}
