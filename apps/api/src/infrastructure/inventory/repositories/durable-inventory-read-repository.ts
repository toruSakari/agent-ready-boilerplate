import type { InventoryReadRepository } from "#api/domain/inventory/repositories/inventory-read-repository.ts";
import { inventoryStub } from "#api/infrastructure/inventory/shared/inventory-stub.ts";
import type { InventoryNamespace } from "#api/infrastructure/inventory/shared/inventory-stub.ts";
import { restoreStoredInventory } from "#api/infrastructure/inventory/mappers/restore-stored-inventory.ts";
import {
  DEFAULT_LEGACY_INVENTORY_TENANT_ID,
  INVENTORY_TENANT_HEADER,
} from "#api/infrastructure/inventory/shared/inventory-scope.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

const READ_CONCURRENCY = 5;

export class DurableInventoryReadRepository implements InventoryReadRepository {
  constructor(
    private readonly namespace: InventoryNamespace,
    private readonly tenantNamespace: InventoryNamespace = namespace,
    private readonly legacyTenantId = DEFAULT_LEGACY_INVENTORY_TENANT_ID,
  ) {}

  async find(tenantId: string, sku: string) {
    const response = await inventoryStub(
      this.namespace,
      this.tenantNamespace,
      this.legacyTenantId,
      tenantId,
      sku,
    ).fetch(`https://inventory/snapshot?sku=${encodeURIComponent(sku)}&allowMissing=true`, {
      headers: { [INVENTORY_TENANT_HEADER]: tenantId },
    });
    if (!response.ok) {
      throw new ApplicationError({
        code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
        message: "在庫を取得できませんでした",
      });
    }

    const item = restoreStoredInventory(await response.json());
    if (item.sku !== sku) {
      throw new Error("在庫のSKUが照会条件と一致しません");
    }

    return item;
  }

  async findMany(tenantId: string, skus: readonly string[]) {
    const unique = [...new Set(skus)];
    const items = [];
    // SKUごとに分かれたDOへの要求は残るため、ページ上限と同時実行数で負荷を制限する。
    for (let i = 0; i < unique.length; i += READ_CONCURRENCY) {
      items.push(
        ...(await Promise.all(
          unique.slice(i, i + READ_CONCURRENCY).map((sku) => this.find(tenantId, sku)),
        )),
      );
    }

    return items;
  }
}
