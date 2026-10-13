import { z } from "zod";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";

const schema = z.object({
  tenantId: z.string().min(1),
  sku: z.unknown().transform(Sku.create),
  onHand: z.unknown().transform(StockQuantity.create),
  updatedAt: z.string().min(1),
});

/** D1台帳の現在庫。予約を含むDOの集約とは別の保存状態。 */
export class StockBalance {
  declare private readonly identityBrand: void;

  private constructor(
    readonly tenantId: string,
    readonly sku: Sku,
    readonly onHand: StockQuantity,
    readonly updatedAt: string,
  ) {
    Object.freeze(this);
  }

  static restore(this: void, value: unknown) {
    const row = schema.parse(value);
    return new StockBalance(row.tenantId, row.sku, row.onHand, row.updatedAt);
  }
}
