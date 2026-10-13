import { StockAdjustmentInput } from "#api/application/inventory/dtos/stock-adjustment-input.ts";
import { ManageStockGetOutputDto } from "#api/application/inventory/dtos/manage-stock-get-output-dto.ts";
import { ManageStockChangeOutputDto } from "#api/application/inventory/dtos/manage-stock-change-output-dto.ts";
import { ManageStockAdjustOutputDto } from "#api/application/inventory/dtos/manage-stock-adjust-output-dto.ts";
import type { ManageStockGetInputDto } from "#api/application/inventory/dtos/manage-stock-get-input-dto.ts";
import type { ManageStockChangeInputDto } from "#api/application/inventory/dtos/manage-stock-change-input-dto.ts";
import type { ManageStockAdjustInputDto } from "#api/application/inventory/dtos/manage-stock-adjust-input-dto.ts";
import type { InventoryReadRepository } from "#api/domain/inventory/repositories/inventory-read-repository.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { InventoryManagementGateway } from "#api/application/inventory/gateways/inventory-management-gateway.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { stockAdjustmentSchema } from "#api/domain/inventory/policies/stock-adjustment.ts";
import { StockOperationId } from "#api/domain/inventory/value-objects/stock-operation-id.ts";

export class ManageStockUseCase {
  constructor(
    private readonly products: Pick<ProductRepository, "find">,
    private readonly inventory: InventoryManagementGateway,
    private readonly reader: Pick<InventoryReadRepository, "find">,
  ) {}

  async get(inputDto: ManageStockGetInputDto): Promise<ManageStockGetOutputDto> {
    const { actor, id } = inputDto;
    const item = await this.reader.find(actor.tenantId, await this.sku(actor, id));
    return ManageStockGetOutputDto.parse({
      onHand: Number(item.onHand),
      reserved: item.reserved,
      available: item.available,
    });
  }

  async change(inputDto: ManageStockChangeInputDto): Promise<ManageStockChangeOutputDto> {
    const { actor, input } = inputDto;
    const sku = await this.sku(actor, input.id);
    let quantity, expectedStock;
    try {
      quantity = StockQuantity.create(input.quantity);
      expectedStock = StockQuantity.create(input.expectedStock);
    } catch (error) {
      if (error instanceof InvalidValueObjectError) {
        throw new ApplicationError({ code: "BAD_REQUEST", message: error.message });
      }

      throw error;
    }

    return ManageStockChangeOutputDto.parse(
      await this.inventory.adjustStock(
        StockAdjustmentInput.parse({
          tenantId: actor.tenantId,
          sku,
          quantity,
          expectedStock,
          operation: "recount",
          reason: "correction",
          operationId: crypto.randomUUID(),
          actorId: actor.userId,
        }),
      ),
    );
  }

  async adjust(inputDto: ManageStockAdjustInputDto): Promise<ManageStockAdjustOutputDto> {
    const { actor, input } = inputDto;
    const sku = await this.sku(actor, input.id);
    const adjustment = stockAdjustmentSchema.safeParse(input.adjustment);
    if (!adjustment.success) {
      throw new ApplicationError({ code: "BAD_REQUEST", message: "在庫操作が不正です" });
    }

    let operationId;
    try {
      operationId = StockOperationId.create(input.operationId);
    } catch (error) {
      if (error instanceof InvalidValueObjectError) {
        throw new ApplicationError({ code: "BAD_REQUEST", message: error.message });
      }

      throw error;
    }

    return ManageStockAdjustOutputDto.parse(
      await this.inventory.adjustStock(
        StockAdjustmentInput.parse({
          ...adjustment.data,
          operationId,
          sku,
          tenantId: actor.tenantId,
          actorId: actor.userId,
        }),
      ),
    );
  }

  private async sku(actor: AuthorizedActor, id: string) {
    const product = await this.products.find(actor.tenantId, id);
    if (!product) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    }

    return product.sku;
  }
}
