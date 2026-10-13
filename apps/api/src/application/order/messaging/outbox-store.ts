import type { OrderEvent } from "#api/domain/order/entities/order.ts";

export type PendingOutboxEvent = Readonly<{
  id: string;
  event: OrderEvent;
}>;

/** 注文と同時保存した配信意図の読取・送信済み記録。消費先の重複処理は別途防ぐ。 */
export interface OutboxStore {
  listPending(limit: number): Promise<PendingOutboxEvent[]>;
  markPublished(id: string, publishedAt: string): Promise<void>;
}
