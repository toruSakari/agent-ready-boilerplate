import { drizzle } from "drizzle-orm/d1";
import { asc, eq, isNull } from "drizzle-orm";
import { outboxEvents } from "#api/infrastructure/order/schemas/schema.ts";
import type { OrderEvent } from "#api/domain/order/entities/order.ts";
import type { OutboxStore } from "#api/application/order/messaging/outbox-store.ts";

export class D1OutboxStore implements OutboxStore {
  private readonly database;

  constructor(binding: D1Database) {
    this.database = drizzle(binding);
  }

  async listPending(limit: number) {
    const rows = await this.database
      .select()
      .from(outboxEvents)
      .where(isNull(outboxEvents.publishedAt))
      .orderBy(asc(outboxEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      event: JSON.parse(row.payload) as OrderEvent,
    }));
  }

  // Queue送信後の記録。送信成功と記録成功は別なので、受信側の冪等性が必要。
  async markPublished(id: string, publishedAt: string): Promise<void> {
    await this.database.update(outboxEvents).set({ publishedAt }).where(eq(outboxEvents.id, id));
  }
}
