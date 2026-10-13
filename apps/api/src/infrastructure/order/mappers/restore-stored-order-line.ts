import { OrderLine } from "#api/domain/order/entities/order-line.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { OrderQuantity } from "#api/domain/order/value-objects/order-quantity.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { isRecord } from "#api/domain/shared/validation.ts";

/** 保存された明細を検証し、単一値をブランド型へ変換してクラスを復元する。 */
export function restoreStoredOrderLine(value: unknown): OrderLine {
  if (!isRecord(value)) {
    throw new InvalidValueObjectError("注文明細が不正です");
  }

  return new OrderLine(
    Sku.create(value.sku),
    ProductName.create(value.name),
    OrderQuantity.create(value.quantity),
    UnitPrice.create(value.unitPrice),
  );
}
