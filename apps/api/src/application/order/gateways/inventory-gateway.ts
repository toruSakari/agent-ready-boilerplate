/** 注文から在庫へ渡す値契約。orderIdは在庫予約の識別子で、下書き確定時は試行ごとのIDを使う。 */
export interface InventoryGateway {
  reserve(input: {
    tenantId: string;
    orderId: string;
    sku: string;
    quantity: number;
  }): Promise<void>;
  /** 未確定の予約だけを解放する。注文保存失敗時の補償に使う。 */
  release(input: { tenantId: string; orderId: string; sku: string }): Promise<void>;
  /** 予約中なら解放し、確定済みなら割当を復元する。取消イベントの再配信を受け入れる。 */
  cancel(input: { tenantId: string; orderId: string; sku: string }): Promise<void>;
  commit(input: { tenantId: string; orderId: string; sku: string }): Promise<void>;
}
