import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import {
  inventoryItems,
  inventoryAdjustments,
} from "#api/infrastructure/inventory/schemas/schema.ts";

/** 商品登録の初期INSERTだけを組み立てる。実行と原子性は呼出元Repositoryが所有する。 */
export function initialStockStatements(
  db: DrizzleD1Database,
  input: {
    tenantId: string;
    sku: string;
    quantity: StockQuantity;
    actorId: string;
    createdAt: string;
  },
) {
  return [
    db.insert(inventoryAdjustments).values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      sku: input.sku,
      actorId: input.actorId,
      operation: "initial",
      reason: "initial",
      quantity: input.quantity,
      beforeStock: 0,
      afterStock: input.quantity,
      expectedStock: null,
      createdAt: input.createdAt,
    }),
    db.insert(inventoryItems).values({
      tenantId: input.tenantId,
      sku: input.sku,
      onHand: input.quantity,
      updatedAt: input.createdAt,
    }),
  ] as const;
}
