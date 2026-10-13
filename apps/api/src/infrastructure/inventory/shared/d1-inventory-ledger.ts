import { DEFAULT_LEGACY_INVENTORY_TENANT_ID } from "#api/infrastructure/inventory/shared/inventory-scope.ts";
import { restoreStoredReservation } from "#api/infrastructure/inventory/mappers/restore-stored-reservation.ts";
import { isTimestamp } from "#api/domain/shared/validation.ts";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  inventoryAllocations,
  inventoryItems,
} from "#api/infrastructure/inventory/schemas/schema.ts";

/** Repository内部で扱うD1の保存行。集約の取得結果としては公開しない。 */
export type InventoryStockRow = Readonly<{ sku: string; onHand: number; updatedAt: string }>;

const D1_MAX_BOUND_PARAMETERS = 100;
const COMMITTED_ORDER_SCOPE_PARAMETERS = 2; // 企業とSKUの絞り込みに使う2個分
const COMMITTED_ORDER_IDS_PER_QUERY = D1_MAX_BOUND_PARAMETERS - COMMITTED_ORDER_SCOPE_PARAMETERS;

export class D1InventoryLedger {
  private readonly database;

  constructor(
    binding: D1Database,
    private readonly tenantId = DEFAULT_LEGACY_INVENTORY_TENANT_ID,
    private readonly legacyTenantId = DEFAULT_LEGACY_INVENTORY_TENANT_ID,
  ) {
    this.database = drizzle(binding);
  }

  async findBySku(sku: string): Promise<InventoryStockRow | null> {
    const [row] = await this.database
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.tenantId, this.tenantId), eq(inventoryItems.sku, sku)))
      .limit(1);

    return row ? { sku: row.sku, onHand: row.onHand, updatedAt: row.updatedAt } : null;
  }

  async save(stock: InventoryStockRow): Promise<void> {
    await this.database
      .insert(inventoryItems)
      .values({ ...stock, tenantId: this.tenantId })
      .onConflictDoUpdate({
        target: [inventoryItems.tenantId, inventoryItems.sku],
        set: {
          onHand: stock.onHand,
          updatedAt: stock.updatedAt,
        },
      });
  }

  async listCommittedOrderIds(sku: string, orderIds: string[]): Promise<string[]> {
    if (orderIds.length === 0) {
      return [];
    }

    // 重複IDを除いてD1のバインド上限内で照合する。途中失敗を部分結果として返さない。
    const uniqueOrderIds = [...new Set(orderIds)];
    const committedOrderIds = new Set<string>();
    for (let offset = 0; offset < uniqueOrderIds.length; offset += COMMITTED_ORDER_IDS_PER_QUERY) {
      const chunk = uniqueOrderIds.slice(offset, offset + COMMITTED_ORDER_IDS_PER_QUERY);
      const rows = await this.database
        .select({ orderId: inventoryAllocations.orderId })
        .from(inventoryAllocations)
        .where(
          and(
            eq(inventoryAllocations.tenantId, this.tenantId),
            eq(inventoryAllocations.sku, sku),
            inArray(inventoryAllocations.orderId, chunk),
          ),
        );
      for (const row of rows) {
        committedOrderIds.add(row.orderId);
      }
    }

    return [...committedOrderIds];
  }

  async findAllocation(input: { orderId: string; sku: string }) {
    const [row] = await this.database
      .select()
      .from(inventoryAllocations)
      .where(
        and(
          eq(inventoryAllocations.tenantId, this.tenantId),
          eq(inventoryAllocations.id, this.allocationId(input)),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }

    if (
      !isTimestamp(row.committedAt) ||
      (row.restoredAt !== null && !isTimestamp(row.restoredAt))
    ) {
      throw new Error("在庫割当の日時が不正です");
    }

    const status = row.restoredAt === null ? ("committed" as const) : ("restored" as const);
    try {
      const reservation = restoreStoredReservation({
        orderId: row.orderId,
        sku: row.sku,
        quantity: row.quantity,
        status,
      });
      if (reservation.status !== "committed" && reservation.status !== "restored") {
        throw new Error("在庫割当の状態が不正です");
      }

      return reservation;
    } catch (error) {
      throw new Error("在庫割当の復元に失敗しました", { cause: error });
    }
  }

  // 復元済みの割当も履歴として残るため、再配送された確定を再度適用しない。
  async isAllocationCommitted(input: { orderId: string; sku: string }): Promise<boolean> {
    const [row] = await this.database
      .select({ id: inventoryAllocations.id })
      .from(inventoryAllocations)
      .where(
        and(
          eq(inventoryAllocations.tenantId, this.tenantId),
          eq(inventoryAllocations.id, this.allocationId(input)),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async commitAllocation(input: {
    orderId: string;
    sku: string;
    quantity: number;
    onHand: number;
    committedAt: string;
  }): Promise<void> {
    if (await this.isAllocationCommitted(input)) {
      return;
    }

    await this.database.batch([
      this.database
        .update(inventoryItems)
        .set({
          onHand: input.onHand,
          updatedAt: input.committedAt,
        })
        .where(and(eq(inventoryItems.tenantId, this.tenantId), eq(inventoryItems.sku, input.sku))),
      this.database.insert(inventoryAllocations).values({
        id: this.allocationId(input),
        tenantId: this.tenantId,
        orderId: input.orderId,
        sku: input.sku,
        quantity: input.quantity,
        committedAt: input.committedAt,
      }),
    ]);
  }

  async restoreAllocation(input: { orderId: string; sku: string; now: string }): Promise<void> {
    // 呼び出し元DOが同じSKUを直列化する。割当行は冪等性の証跡として削除しない。
    const allocation = this.database
      .select({ quantity: inventoryAllocations.quantity })
      .from(inventoryAllocations)
      .where(
        and(
          eq(inventoryAllocations.id, this.allocationId(input)),
          eq(inventoryAllocations.tenantId, this.tenantId),
          isNull(inventoryAllocations.restoredAt),
        ),
      );
    await this.database.batch([
      this.database
        .update(inventoryItems)
        .set({
          onHand: sql`${inventoryItems.onHand} + coalesce((${allocation}),0)`,
          updatedAt: input.now,
        })
        .where(and(eq(inventoryItems.sku, input.sku), eq(inventoryItems.tenantId, this.tenantId))),
      this.database
        .update(inventoryAllocations)
        .set({ restoredAt: input.now })
        .where(
          and(
            eq(inventoryAllocations.id, this.allocationId(input)),
            eq(inventoryAllocations.tenantId, this.tenantId),
            isNull(inventoryAllocations.restoredAt),
          ),
        ),
    ]);
  }

  // 旧企業のID形式を維持し、新企業には区切り文字の衝突がない複合キーを使う。
  private allocationId(input: { orderId: string; sku: string }): string {
    return this.tenantId === this.legacyTenantId
      ? `${input.orderId}:${input.sku}`
      : JSON.stringify([this.tenantId, input.orderId, input.sku]);
  }
}
