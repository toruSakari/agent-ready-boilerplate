import type { StockBalance } from "#api/domain/inventory/entities/stock-balance.ts";

export interface StockBalanceRepository {
  findForProducts(products: readonly { tenantId: string; sku: string }[]): Promise<StockBalance[]>;
}
