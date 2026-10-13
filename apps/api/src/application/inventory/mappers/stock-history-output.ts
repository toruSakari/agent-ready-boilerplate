import { StockHistoryEntryDto } from "#api/application/inventory/dtos/stock-history-output.ts";
import type { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";

/** 公開履歴には内部の企業・SKU・会員IDや期待版を混ぜない。 */
export function stockHistoryOutput(entry: StockAdjustmentEntry): StockHistoryEntryDto {
  const { id, operation, reason, quantity, beforeStock, afterStock, createdAt, actorName } =
    entry.toSnapshot();
  return StockHistoryEntryDto.parse({
    id,
    operation,
    reason,
    quantity: Number(quantity),
    beforeStock: Number(beforeStock),
    afterStock: Number(afterStock),
    createdAt,
    actorName,
  });
}
