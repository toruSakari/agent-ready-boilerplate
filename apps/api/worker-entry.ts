import { CleanupProductImagesInputDto } from "#api/application/product/dtos/cleanup-product-images-input-dto.ts";
import { PublishOutboxInputDto } from "#api/application/order/dtos/publish-outbox-input-dto.ts";
import { withRequestLogging } from "@dev-template/config/request-logging";
import { createSentryOptions } from "#api/infrastructure/observability/sentry-options.ts";
import { defineLogEvent, logEvent } from "@dev-template/config/logging";
import * as Sentry from "@sentry/cloudflare";
import { apiApp } from "#api/presentation/api-app.ts";
import { createContainer } from "#api/composition-root.ts";
import type { OrderEvent } from "#api/domain/order/entities/order.ts";
import { consumeOrderEvents } from "#api/infrastructure/order/messaging/order-event-consumer.ts";

export { RequestThrottle } from "#api/infrastructure/security/durable-objects/request-throttle.ts";

const outboxPublished = defineLogEvent("outbox_published", "注文イベントを配信しました", ["count"]);
const productImagesCleanup = defineLogEvent(
  "product_images_cleanup",
  "商品画像の清掃を実行しました",
  ["deleted", "failed"],
);
// 公開クラス名はWranglerのDO移行履歴と結び付いているため、内部配置と独立して維持する。
export { TenantInventoryReservation } from "#api/infrastructure/inventory/durable-objects/tenant-inventory-reservation.ts";
export { InventoryReservation } from "#api/infrastructure/inventory/durable-objects/inventory-reservation.ts";

const worker = {
  fetch: withRequestLogging(apiApp.fetch, "api"),
  async scheduled(_controller: ScheduledController, _env: Env, context: ExecutionContext) {
    const container = createContainer();
    // 配信と画像清掃を別々に待機登録し、片方の失敗で他方の開始を止めない。
    context.waitUntil(
      container.publishOutbox
        .execute(PublishOutboxInputDto.parse({}))
        .then((result) => result.publishedCount)
        .then((count) => {
          logEvent("info", outboxPublished, { count });
        }),
    );
    context.waitUntil(
      container.cleanupProductImages
        .execute(CleanupProductImagesInputDto.parse({}))
        .then((result) => {
          logEvent("info", productImagesCleanup, { ...result });
        }),
    );
  },
  async queue(batch: MessageBatch<OrderEvent>, env: Env) {
    await consumeOrderEvents(batch, env);
  },
} satisfies ExportedHandler<Env, OrderEvent>;
export default Sentry.withSentry(createSentryOptions, worker);
