import { OrderLine } from "#api/domain/order/entities/order-line.ts";
import type { OrderLineSnapshot } from "#api/domain/order/entities/order-line.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { OrderQuantity } from "#api/domain/order/value-objects/order-quantity.ts";

/** UseCaseの入力境界でブランド値を生成し、注文明細へ渡す。 */
export function createOrderLine(value: OrderLineSnapshot): OrderLine {
  return new OrderLine(
    Sku.create(value.sku),
    ProductName.create(value.name),
    OrderQuantity.create(value.quantity),
    UnitPrice.create(value.unitPrice),
  );
}
