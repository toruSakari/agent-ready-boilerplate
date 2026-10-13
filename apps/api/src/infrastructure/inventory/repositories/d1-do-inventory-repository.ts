import { drizzle } from "drizzle-orm/d1";
import type {
  StockAdjustmentEntry,
  StockAdjustmentSnapshot,
} from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import {
  inventoryAdjustments,
  inventoryItems,
} from "#api/infrastructure/inventory/schemas/schema.ts";
import type { InventoryRepository } from "#api/domain/inventory/repositories/inventory-repository.ts";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import { InvalidInventoryError } from "#api/domain/inventory/errors/invalid-inventory-error.ts";
import type { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { restoreStoredInventory } from "#api/infrastructure/inventory/mappers/restore-stored-inventory.ts";
import { D1InventoryLedger } from "#api/infrastructure/inventory/shared/d1-inventory-ledger.ts";

// DOのKV削除上限。D1照合のチャンク数とは別のAPI制約なので独立して持つ。
const MAX_STORAGE_DELETE_KEYS = 128;

/** 在庫の保存形式とD1・DO間の保存順序を所有し、復元済みEntityだけをDOへ返す。 */
export class D1DoInventoryRepository implements InventoryRepository {
  private readonly ledger;
  private readonly db;

  constructor(
    binding: D1Database,
    private readonly storage: DurableObjectStorage,
    private readonly tenantId: string,
    legacyTenantId: string,
  ) {
    this.ledger = new D1InventoryLedger(binding, tenantId, legacyTenantId);
    this.db = drizzle(binding);
  }

  async find(sku: string, allowMissing = false): Promise<InventoryItem | null> {
    if (typeof sku !== "string" || sku.trim().length === 0) {
      throw new InvalidInventoryError("在庫のSKUを指定してください");
    }

    Sku.create(sku);
    // 旧DOの現在庫キャッシュを捨て、正本であるD1を毎回読む。
    await this.storage.delete("stock");
    const stock = await this.ledger.findBySku(sku);
    if (!stock && !allowMissing) {
      return null;
    }

    const reservations = await this.storage.list<number>({ prefix: "reservation:" });
    const orderIds = [...reservations.keys()].map((key) => key.slice("reservation:".length));
    // 照合・削除の途中失敗では新たな操作へ進まず、次の要求で残存分を再照合する。
    const committedOrderIds = new Set(await this.ledger.listCommittedOrderIds(sku, orderIds));
    const staleKeys = [...reservations.keys()].filter((key) =>
      committedOrderIds.has(key.slice("reservation:".length)),
    );
    for (let offset = 0; offset < staleKeys.length; offset += MAX_STORAGE_DELETE_KEYS) {
      await this.storage.delete(staleKeys.slice(offset, offset + MAX_STORAGE_DELETE_KEYS));
    }

    try {
      return restoreStoredInventory({
        sku,
        onHand: stock?.onHand ?? 0,
        reservations: [...reservations.entries()]
          .filter((props) => !committedOrderIds.has(props[0].slice("reservation:".length)))
          .map((props) => ({ orderId: props[0].slice("reservation:".length), quantity: props[1] })),
      });
    } catch (error) {
      throw new Error("在庫台帳の復元に失敗しました", { cause: error });
    }
  }

  async save(item: InventoryItem): Promise<void> {
    const [event] = item.events;
    if (!event || item.events.length !== 1) {
      throw new InvalidInventoryError("今回の変更を持つ在庫を指定してください");
    }

    switch (event.name) {
      case "inventory.reserved":
        await this.storage.put(`reservation:${event.payload.orderId}`, event.payload.quantity);
        return;
      case "inventory.reservation-released":
        await this.endReservation(event.payload.orderId);
        return;
      case "inventory.reservation-committed":
        // D1確定後のDO削除に失敗しても、次のfindで割当と照合して除去する。
        await this.ledger.commitAllocation({
          orderId: event.payload.orderId,
          sku: item.sku,
          quantity: event.payload.quantity,
          onHand: item.onHand,
          committedAt: event.occurredAt,
        });
        await this.removeReservation(event.payload.orderId);
        return;
      case "inventory.stock-changed":
        await this.ledger.save({ sku: item.sku, onHand: item.onHand, updatedAt: event.occurredAt });
    }
  }

  async saveAdjustment(item: InventoryItem, adjustment: StockAdjustmentEntry): Promise<void> {
    const { actorName: _actorName, ...record } = adjustment.toSnapshot();
    if (record.tenantId !== this.tenantId || record.sku !== item.sku) {
      throw new InvalidInventoryError("在庫と履歴の企業・SKUが一致しません");
    }

    this.assertAdjustmentChange(item, record);
    // 読取からここまでを呼出元DOが直列化する。履歴の重複・途中失敗は在庫ごと取り消す。
    await this.db.batch([
      this.db.insert(inventoryAdjustments).values(record),
      this.db
        .insert(inventoryItems)
        .values({
          tenantId: this.tenantId,
          sku: item.sku,
          onHand: item.onHand,
          updatedAt: record.createdAt,
        })
        .onConflictDoUpdate({
          target: [inventoryItems.tenantId, inventoryItems.sku],
          set: { onHand: item.onHand, updatedAt: record.createdAt },
        }),
    ]);
  }

  private assertAdjustmentChange(
    item: InventoryItem,
    record: Omit<StockAdjustmentSnapshot, "actorName">,
  ): void {
    const [event] = item.events;
    if (!event || item.events.length !== 1 || event.name !== "inventory.stock-changed") {
      throw new InvalidInventoryError("今回の在庫変更を持つ在庫を指定してください");
    }

    if (
      event.id !== record.id ||
      event.occurredAt !== record.createdAt ||
      event.aggregateId !== item.sku ||
      event.payload.previousOnHand !== record.beforeStock ||
      event.payload.onHand !== record.afterStock ||
      item.onHand !== record.afterStock
    ) {
      throw new InvalidInventoryError("在庫の変更と履歴が一致しません");
    }
  }

  async findAllocation(input: { orderId: string; sku: string }) {
    return this.ledger.findAllocation(input);
  }

  async restoreAllocation(allocation: StockReservationEntity<"restored">, now: string) {
    await this.ledger.restoreAllocation({ orderId: allocation.orderId, sku: allocation.sku, now });
  }

  async isAllocationCommitted(input: { orderId: string; sku: string }) {
    return this.ledger.isAllocationCommitted(input);
  }

  async hasEndedReservation(orderId: string): Promise<boolean> {
    return Boolean(
      (await this.storage.get(`cancelled:${orderId}`)) ||
      (await this.storage.get(`released:${orderId}`)),
    );
  }

  async markCancelled(orderId: string): Promise<void> {
    await this.storage.put(`cancelled:${orderId}`, true);
  }

  async endReservation(orderId: string): Promise<void> {
    await this.storage.put(`released:${orderId}`, true);
    await this.removeReservation(orderId);
  }

  async removeReservation(orderId: string): Promise<void> {
    await this.storage.delete(`reservation:${orderId}`);
  }
}
