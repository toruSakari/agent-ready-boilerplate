import { InventoryOverviewListOutputDto } from "#api/application/inventory/dtos/inventory-overview-list-output-dto.ts";
import { InventoryOverviewHistoryOutputDto } from "#api/application/inventory/dtos/inventory-overview-history-output-dto.ts";
import type { InventoryOverviewListInputDto } from "#api/application/inventory/dtos/inventory-overview-list-input-dto.ts";
import type { InventoryOverviewHistoryInputDto } from "#api/application/inventory/dtos/inventory-overview-history-input-dto.ts";
import type { StockAdjustmentRepository } from "#api/domain/inventory/repositories/stock-adjustment-repository.ts";
import { stockHistoryOutput } from "#api/application/inventory/mappers/stock-history-output.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { InventoryReadRepository } from "#api/domain/inventory/repositories/inventory-read-repository.ts";
import { pageRequest, PAGE_LIMITS } from "#api/application/shared/pagination.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

export class InventoryOverviewUseCase {
  constructor(
    private readonly adjustments: Pick<StockAdjustmentRepository, "history">,
    private readonly products: Pick<ProductRepository, "find" | "list">,
    private readonly inventory: Pick<InventoryReadRepository, "findMany">,
  ) {}

  async list(inputDto: InventoryOverviewListInputDto): Promise<InventoryOverviewListOutputDto> {
    const { actor, request, filters } = inputDto;
    const page = pageRequest(request);
    // 在庫一覧はDO照会を伴うため、他の一覧より小さい固定上限を使う。
    if (page.limit > PAGE_LIMITS.defaultSize) {
      throw new ApplicationError({
        code: "BAD_REQUEST",
        message: "在庫一覧の取得件数が上限を超えています",
      });
    }

    const rows = await this.products.list(actor.tenantId, page, filters);
    const stocks = await this.inventory.findMany(
      actor.tenantId,
      rows.map((product) => String(product.sku)),
    );
    const bySku = new Map(stocks.map((stock) => [String(stock.sku), stock]));
    return InventoryOverviewListOutputDto.parse({
      items: rows.map((product) => {
        const stock = bySku.get(product.sku);
        if (!stock) {
          throw new Error("商品の在庫集約を取得できませんでした");
        }

        return {
          id: product.id,
          sku: String(product.sku),
          name: String(product.name),
          createdAt: product.createdAt,
          onHand: Number(stock.onHand),
          reserved: stock.reserved,
          available: stock.available,
        };
      }),
    });
  }

  async history(
    inputDto: InventoryOverviewHistoryInputDto,
  ): Promise<InventoryOverviewHistoryOutputDto> {
    const { actor, id, request } = inputDto;
    const product = await this.products.find(actor.tenantId, id);
    if (!product) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    }

    return InventoryOverviewHistoryOutputDto.parse({
      items: (
        await this.adjustments.history(actor.tenantId, product.sku, pageRequest(request))
      ).map(stockHistoryOutput),
    });
  }
}
