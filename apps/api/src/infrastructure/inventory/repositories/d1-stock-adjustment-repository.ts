import { and, eq, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { inventoryAdjustments } from "#api/infrastructure/inventory/schemas/schema.ts";
import {
  businessAccounts,
  businessMemberships,
} from "#api/infrastructure/access/schemas/schema.ts";
import { cursorPagination } from "#api/infrastructure/shared/cursor-pagination.ts";
import type { StockAdjustmentRepository } from "#api/domain/inventory/repositories/stock-adjustment-repository.ts";
import { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import type { PageRequest } from "#api/domain/shared/page-request.ts";

export class D1StockAdjustmentRepository implements StockAdjustmentRepository {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async find(tenantId: string, id: string): Promise<StockAdjustmentEntry | null> {
    const [row] = await this.db
      .select()
      .from(inventoryAdjustments)
      .where(and(eq(inventoryAdjustments.tenantId, tenantId), eq(inventoryAdjustments.id, id)))
      .limit(1);
    if (!row) {
      return null;
    }

    try {
      return StockAdjustmentEntry.restore({ ...row, actorName: null });
    } catch (error) {
      throw new Error("在庫変更履歴の復元に失敗しました", { cause: error });
    }
  }

  async history(tenantId: string, sku: string, page: PageRequest) {
    const table = inventoryAdjustments;
    const pagination = cursorPagination(table, page.cursor);
    // 氏名は現在も同じ企業に所属する企業担当者だけ。一般ユーザーや他企業の会員情報には結合しない。
    const rows = await this.db
      .select({
        ...getTableColumns(table),
        actorName: businessAccounts.name,
      })
      .from(table)
      .leftJoin(
        businessMemberships,
        and(
          eq(businessMemberships.organizationsId, tenantId),
          eq(businessMemberships.businessAccountsId, table.actorId),
        ),
      )
      .leftJoin(
        businessAccounts,
        and(
          eq(businessAccounts.id, businessMemberships.businessAccountsId),
          eq(businessAccounts.deleted, false),
        ),
      )
      .where(and(eq(table.tenantId, tenantId), eq(table.sku, sku), pagination.after))
      .orderBy(...pagination.order)
      .limit(page.limit);
    return rows.map((row) => StockAdjustmentEntry.restore(row));
  }
}
