import type { OrderEvent } from "#api/domain/order/entities/order.ts";

/** イベントを配送先へ渡す契約。送信成功は、消費先の業務処理完了を意味しない。 */
export interface EventPublisher {
  publish(event: OrderEvent): Promise<void>;
}
