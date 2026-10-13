import type { ManagedStockDto } from "#api/application/inventory/dtos/managed-stock-output.ts";
import type { StockAdjustmentInput } from "#api/application/inventory/dtos/stock-adjustment-input.ts";

export interface InventoryManagementGateway {
  adjustStock(input: StockAdjustmentInput): Promise<ManagedStockDto>;
  changeStock(input: {
    tenantId: string;
    sku: string;
    quantity: number;
    expectedStock: number;
  }): Promise<ManagedStockDto>;
}
