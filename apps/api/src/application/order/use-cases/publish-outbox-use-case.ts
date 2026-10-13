import { PublishOutboxOutputDto } from "#api/application/order/dtos/publish-outbox-output-dto.ts";
import type { PublishOutboxInputDto } from "#api/application/order/dtos/publish-outbox-input-dto.ts";
import type { EventPublisher } from "#api/application/order/messaging/event-publisher.ts";
import type { OutboxStore } from "#api/application/order/messaging/outbox-store.ts";

const DEFAULT_OUTBOX_BATCH_SIZE = 50;

export class PublishOutboxUseCase {
  constructor(
    private readonly outbox: OutboxStore,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(inputDto: PublishOutboxInputDto): Promise<PublishOutboxOutputDto> {
    const { limit = DEFAULT_OUTBOX_BATCH_SIZE } = inputDto;
    const pending = await this.outbox.listPending(limit);
    for (const item of pending) {
      // 送信を先に行いイベント欠落を防ぐ。送信済み記録の失敗では重複配信が起きるため、消費側は冪等にする。
      await this.publisher.publish(item.event);
      await this.outbox.markPublished(item.id, new Date().toISOString());
    }

    return PublishOutboxOutputDto.parse({ publishedCount: pending.length });
  }
}
