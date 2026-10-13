import { D1StockAdjustmentRepository } from "#api/infrastructure/inventory/repositories/d1-stock-adjustment-repository.ts";
import { stockHistoryOutput } from "#api/application/inventory/mappers/stock-history-output.ts";
import type { StockAdjustmentRepository } from "#api/domain/inventory/repositories/stock-adjustment-repository.ts";

export function stockHistoryReader(binding: D1Database) {
  const repository = new D1StockAdjustmentRepository(binding);
  return {
    history: async (...args: Parameters<StockAdjustmentRepository["history"]>) =>
      (await repository.history(...args)).map(stockHistoryOutput),
  };
}
