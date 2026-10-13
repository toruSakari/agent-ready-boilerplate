import { and, asc, eq, gt, gte, lte, sql, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { products, productImages } from "#api/infrastructure/product/schemas/schema.ts";
import { organizations } from "#api/infrastructure/access/schemas/schema.ts";
import { inventoryItems } from "#api/infrastructure/inventory/schemas/schema.ts";
import { cursorPagination } from "#api/infrastructure/shared/cursor-pagination.ts";
import { textSearch } from "#api/infrastructure/shared/list-conditions.ts";
import { restoreProductRows } from "#api/infrastructure/product/mappers/restore-product-rows.ts";
import type { PageRequest } from "#api/domain/shared/page-request.ts";
import type { StoreFilters } from "#api/domain/shared/list-filters.ts";

export async function publicProducts(
  db: DrizzleD1Database,
  page: PageRequest,
  search?: string,
  filters: StoreFilters = {},
) {
  const cursor = cursorPagination(products, page.cursor, filters.sort);
  const ids = db
    .select({ id: products.id })
    .from(products)
    .innerJoin(
      organizations,
      and(eq(organizations.id, products.tenantId), eq(organizations.active, true)),
    )
    .leftJoin(
      inventoryItems,
      and(eq(inventoryItems.tenantId, products.tenantId), eq(inventoryItems.sku, products.sku)),
    )
    .where(
      and(
        cursor.after,
        textSearch([products.name, products.sku], search),
        filters.stock === "in-stock" ? gt(inventoryItems.onHand, 0) : undefined,
        filters.stock === "out-of-stock" ? sql`coalesce(${inventoryItems.onHand},0)=0` : undefined,
        filters.minPrice !== undefined ? gte(products.unitPrice, filters.minPrice) : undefined,
        filters.maxPrice !== undefined ? lte(products.unitPrice, filters.maxPrice) : undefined,
      ),
    )
    .orderBy(...cursor.order)
    .limit(page.limit + 1);
  const rows = await db
    .select({ product: products, image: productImages })
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.tenantId, products.tenantId),
        eq(productImages.productsId, products.id),
        eq(productImages.state, "active"),
      ),
    )
    .where(inArray(products.id, ids))
    .orderBy(...cursor.order, asc(productImages.createdAt), asc(productImages.id));
  return restoreProductRows(rows);
}
