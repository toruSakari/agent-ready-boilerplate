import { ManagedStockDto } from "#api/application/inventory/dtos/managed-stock-output.ts";
import { inventoryStub } from "#api/infrastructure/inventory/shared/inventory-stub.ts";
import type { InventoryNamespace } from "#api/infrastructure/inventory/shared/inventory-stub.ts";
import type { StockAdjustmentInput } from "#api/application/inventory/dtos/stock-adjustment-input.ts";
import { z } from "zod";
import type { InventoryManagementGateway } from "#api/application/inventory/gateways/inventory-management-gateway.ts";
import {
  DEFAULT_LEGACY_INVENTORY_TENANT_ID,
  INVENTORY_TENANT_HEADER,
} from "#api/infrastructure/inventory/shared/inventory-scope.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

const stockResponse = z.object({
  stock: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
});

export class InventoryDurableObjectGateway implements InventoryGateway, InventoryManagementGateway {
  constructor(
    private readonly namespace: InventoryNamespace,
    private readonly tenantNamespace: InventoryNamespace = namespace,
    private readonly legacyTenantId = DEFAULT_LEGACY_INVENTORY_TENANT_ID,
  ) {}

  async reserve(input: {
    tenantId: string;
    orderId: string;
    sku: string;
    quantity: number;
  }): Promise<void> {
    const response = await this.stub(input.tenantId, input.sku).fetch(
      "https://inventory/reservations",
      {
        method: "POST",
        headers: { "content-type": "application/json", [INVENTORY_TENANT_HEADER]: input.tenantId },
        body: JSON.stringify(input),
      },
    );
    await this.ensureSuccess(response, "在庫を予約できませんでした");
  }

  async release(input: { tenantId: string; orderId: string; sku: string }): Promise<void> {
    const response = await this.stub(input.tenantId, input.sku).fetch(
      `https://inventory/reservations/${input.orderId}?sku=${encodeURIComponent(input.sku)}`,
      {
        method: "DELETE",
        headers: { [INVENTORY_TENANT_HEADER]: input.tenantId },
      },
    );
    await this.ensureSuccess(response, "在庫予約を解除できませんでした");
  }

  async commit(input: { tenantId: string; orderId: string; sku: string }): Promise<void> {
    const response = await this.stub(input.tenantId, input.sku).fetch(
      `https://inventory/reservations/${input.orderId}/commit?sku=${encodeURIComponent(input.sku)}`,
      {
        method: "POST",
        headers: { [INVENTORY_TENANT_HEADER]: input.tenantId },
      },
    );
    await this.ensureSuccess(response, "在庫予約を確定できませんでした");
  }

  async cancel(input: { tenantId: string; orderId: string; sku: string }): Promise<void> {
    const response = await this.stub(input.tenantId, input.sku).fetch(
      `https://inventory/allocations/${encodeURIComponent(input.orderId)}/cancel?sku=${encodeURIComponent(input.sku)}`,
      { method: "POST", headers: { [INVENTORY_TENANT_HEADER]: input.tenantId } },
    );
    await this.ensureSuccess(response, "在庫の取消に失敗しました");
  }

  async adjustStock(input: StockAdjustmentInput): Promise<ManagedStockDto> {
    const { tenantId, sku, actorId, operationId, ...adjustment } = input;
    const response = await this.stub(tenantId, sku).fetch("https://inventory/adjustments", {
      method: "POST",
      headers: { "content-type": "application/json", [INVENTORY_TENANT_HEADER]: tenantId },
      body: JSON.stringify({ sku, actorId, operationId, adjustment }),
    });
    return await this.readStock(response);
  }

  async changeStock(input: {
    tenantId: string;
    sku: string;
    quantity: number;
    expectedStock: number;
  }): Promise<ManagedStockDto> {
    const response = await this.stub(input.tenantId, input.sku).fetch("https://inventory/stock", {
      method: "POST",
      headers: { "content-type": "application/json", [INVENTORY_TENANT_HEADER]: input.tenantId },
      body: JSON.stringify(input),
    });
    return await this.readStock(response);
  }

  private async readStock(response: Response): Promise<ManagedStockDto> {
    if (response.status === 409) {
      const reason = z
        .object({ reason: z.enum(["STOCK_CHANGED", "STOCK_RESERVED", "STOCK_OPERATION_CONFLICT"]) })
        .safeParse(await response.json());
      if (reason.success) {
        throw new ApplicationError({
          code: "CONFLICT",
          reason: reason.data.reason,
          message: "最新の在庫を確認してください",
        });
      }
    }

    await this.ensureSuccess(response, "在庫を取得・更新できませんでした");
    const result = stockResponse.parse(await response.json());
    return ManagedStockDto.parse({
      onHand: result.stock,
      reserved: result.reserved,
      available: result.available,
    });
  }

  // 旧企業は既存のSKU名・DO名前空間を保ち、新企業だけを複合キーと別名前空間へ送る。
  private stub(tenantId: string, sku: string): Pick<DurableObjectStub, "fetch"> {
    return inventoryStub(this.namespace, this.tenantNamespace, this.legacyTenantId, tenantId, sku);
  }

  private async ensureSuccess(response: Response, fallback: string): Promise<void> {
    if (!response.ok) {
      // 上流の本文（内部エラーやHTMLを含む可能性がある）は利用者へ転送しない。
      if (response.status === 409) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "在庫が不足しているか、予約が競合しています",
        });
      }

      if (response.status === 400) {
        throw new ApplicationError({
          code: "BAD_REQUEST",
          message: "在庫の予約内容が不正です。SKUと数量を確認してください",
        });
      }

      if (response.status === 404) {
        throw new ApplicationError({ code: "NOT_FOUND", message: "対象の在庫が見つかりません" });
      }

      throw new ApplicationError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
    }
  }
}
