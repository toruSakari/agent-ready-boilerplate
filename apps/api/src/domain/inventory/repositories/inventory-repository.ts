import type { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import type { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import type { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";

/** D1台帳とDO予約を合わせて復元・保存する。同じ企業・SKUの直列化は呼出元が担う。 */
export interface InventoryRepository {
  /** 未登録ならnull。初期化時だけ、在庫0と残存予約の整合性を検証して返す。 */
  find(sku: string, allowMissing?: boolean): Promise<InventoryItem | null>;
  /** 今回の変更イベントを持つEntityを保存する。確定はD1を先に保存してからDO予約を除く。 */
  save(item: InventoryItem): Promise<void>;
  /** 入荷・棚卸しで変更した在庫と、その変更に対応する履歴を原子的に保存する。 */
  saveAdjustment(item: InventoryItem, adjustment: StockAdjustmentEntry): Promise<void>;
  findAllocation(input: {
    orderId: string;
    sku: string;
  }): Promise<StockReservationEntity<"committed"> | StockReservationEntity<"restored"> | null>;
  restoreAllocation(allocation: StockReservationEntity<"restored">, now: string): Promise<void>;
  isAllocationCommitted(input: { orderId: string; sku: string }): Promise<boolean>;
  hasEndedReservation(orderId: string): Promise<boolean>;
  /** 取消印はD1復元より先に保存し、復元失敗後も遅れた確定を拒否する。 */
  markCancelled(orderId: string): Promise<void>;
  /** 予約が未検出でも解放印を残し、同じIDの再利用を拒否する。 */
  endReservation(orderId: string): Promise<void>;
  removeReservation(orderId: string): Promise<void>;
}
