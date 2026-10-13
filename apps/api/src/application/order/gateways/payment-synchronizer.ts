import type { OrderStatus } from "#api/domain/order/entities/order.ts";

/** 決済コンテキストへ注文の値だけを渡す。Order集約や決済ユースケースの実装へ直接依存しない。 */
export interface OrderPaymentSynchronizer {
  execute(input: {
    id: string;
    tenantId: string;
    total: number;
    version: number;
    status: OrderStatus;
    createdAt: string;
  }): Promise<void>;
}
