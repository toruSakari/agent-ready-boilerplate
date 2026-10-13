import type { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import type { PageRequest } from "#api/domain/shared/page-request.ts";

export interface StockAdjustmentRepository {
  find(tenantId: string, id: string): Promise<StockAdjustmentEntry | null>;
  history(tenantId: string, sku: string, page: PageRequest): Promise<StockAdjustmentEntry[]>;
}
