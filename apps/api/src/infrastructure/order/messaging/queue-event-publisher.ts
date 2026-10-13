import type { OrderEvent } from "#api/domain/order/entities/order.ts";
import type { EventPublisher } from "#api/application/order/messaging/event-publisher.ts";

export class QueueEventPublisher implements EventPublisher {
  constructor(private readonly queue: Queue<OrderEvent>) {}

  // ここでは配送受付だけを待つ。Outboxの配信済み記録は呼び出し元ユースケースが行う。
  async publish(event: OrderEvent): Promise<void> {
    await this.queue.send(event, { contentType: "json" });
  }
}
