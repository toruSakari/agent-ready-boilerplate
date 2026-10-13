import type { Product } from "#api/domain/product/entities/product.ts";
import type { OrganizationRepository } from "#api/domain/access/repositories/organization-repository.ts";
import type { StockBalanceRepository } from "#api/domain/inventory/repositories/stock-balance-repository.ts";
import { StoreProductDto } from "#api/application/store/dtos/store-product-dto.ts";

export async function presentStoreProducts(
  products: readonly Product[],
  organizations: Pick<OrganizationRepository, "findMany">,
  stock: StockBalanceRepository,
): Promise<StoreProductDto[]> {
  if (!products.length) {
    return [];
  }

  const [sellers, balances] = await Promise.all([
    organizations.findMany(products.map((p) => p.tenantId)),
    stock.findForProducts(products),
  ]);
  const names = new Map(sellers.filter((s) => s.active).map((s) => [String(s.id), String(s.name)]));
  const quantities = new Map(
    balances.map((s) => [JSON.stringify([s.tenantId, s.sku]), Number(s.onHand)]),
  );
  return products
    .flatMap((p) => {
      const organizationName = names.get(p.tenantId);
      if (!organizationName) {
        return [];
      }

      return [
        {
          id: p.id,
          tenantId: p.tenantId,
          sku: String(p.sku),
          name: String(p.name),
          unitPrice: Number(p.unitPrice),
          createdAt: p.createdAt,
          organizationName,
          availableQuantity: quantities.get(JSON.stringify([p.tenantId, p.sku])) ?? 0,
          images: p.images.map((image) => ({ id: image.id })),
        },
      ];
    })
    .map((item) => StoreProductDto.parse(item));
}
