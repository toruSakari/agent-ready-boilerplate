import { ProcessOrderEventInputDto } from "#api/application/order/dtos/process-order-event-input-dto.ts";
import { defineLogEvent, logEvent } from "@dev-template/config/logging";
import { createOrderEventProcessor } from "#api/composition-root.ts";
import type { OrderEvent } from "#api/domain/order/entities/order.ts";
import { drizzle } from "drizzle-orm/d1";
import { orderEventHistory } from "#api/infrastructure/order/schemas/schema.ts";

const orderEventFailed = defineLogEvent("order_event_failed", "注文イベント処理に失敗しました", [
  "eventId",
  "orderId",
]);

export async function consumeOrderEvents(batch: MessageBatch<OrderEvent>, env: Env): Promise<void> {
  const database = drizzle(env.DB);
  const processor = createOrderEventProcessor(env);
  for (const message of batch.messages) {
    const event = message.body;
    try {
      await processor.execute(ProcessOrderEventInputDto.parse({ event }));
      // 処理履歴はイベントIDで重複させない。業務処理そのものの再実行耐性はprocessorが担う。
      await database
        .insert(orderEventHistory)
        .values({
          eventId: event.id,
          tenantId: event.payload.tenantId,
          orderId: event.aggregateId,
          eventType: event.name,
          occurredAt: event.occurredAt,
          processedAt: new Date().toISOString(),
        })
        .onConflictDoNothing();
      // 業務処理と履歴保存の両方が成功してから確認し、途中失敗は同じイベントを再配送させる。
      message.ack();
    } catch {
      logEvent("error", orderEventFailed, { eventId: event.id, orderId: event.aggregateId });
      message.retry();
    }
  }
}
