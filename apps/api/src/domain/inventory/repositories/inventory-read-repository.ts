import type { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";

/** 通信越しにもDOの集約を復元し、UseCaseへ予約の合計DTOを渡さない。 */
export interface InventoryReadRepository {
  find(tenantId: string, sku: string): Promise<InventoryItem>;
  findMany(tenantId: string, skus: readonly string[]): Promise<InventoryItem[]>;
}
