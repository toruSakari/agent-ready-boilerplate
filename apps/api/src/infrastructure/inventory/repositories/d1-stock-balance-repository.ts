import { drizzle } from "drizzle-orm/d1";
import { and, eq, or } from "drizzle-orm";
import { inventoryItems } from "#api/infrastructure/inventory/schemas/schema.ts";
import { StockBalance } from "#api/domain/inventory/entities/stock-balance.ts";
import type { StockBalanceRepository } from "#api/domain/inventory/repositories/stock-balance-repository.ts";

export class D1StockBalanceRepository implements StockBalanceRepository {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async findForProducts(products: readonly { tenantId: string; sku: string }[]) {
    const statements = [];
    for (let i = 0; i < products.length; i += 50) {
      statements.push(
        this.db
          .select()
          .from(inventoryItems)
          .where(
            or(
              ...products
                .slice(i, i + 50)
                .map((product) =>
                  and(
                    eq(inventoryItems.tenantId, product.tenantId),
                    eq(inventoryItems.sku, product.sku),
                  ),
                ),
            ),
          ),
      );
    }

    const [first, ...rest] = statements;
    if (!first) {
      return [];
    }

    return (await this.db.batch([first, ...rest])).flat().map(StockBalance.restore);
  }
}
