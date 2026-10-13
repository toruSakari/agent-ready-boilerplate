import { SynchronizePaymentInputDto } from "#api/application/payment/dtos/synchronize-payment-input-dto.ts";
import { ProcessOrderEventInputDto } from "#api/application/order/dtos/process-order-event-input-dto.ts";
import { StoreListInputDto } from "#api/application/store/dtos/store-list-input-dto.ts";
import { StoreCancelOrderInputDto } from "#api/application/store/dtos/store-cancel-order-input-dto.ts";
import { OrderPaymentSynchronizationGateway } from "#api/infrastructure/payment/gateways/order-payment-synchronizer.ts";
// @vitest-environment node
import { orderReader } from "#api/test/order-reader.ts";
import { D1OutboxStore } from "#api/infrastructure/order/messaging/d1-outbox-store.ts";
import { StoreUseCase } from "#api/application/store/use-cases/store-use-case.ts";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import { ProcessOrderEventUseCase } from "#api/application/order/use-cases/process-order-event-use-case.ts";
import { SynchronizePaymentUseCase } from "#api/application/payment/use-cases/synchronize-payment-use-case.ts";
import { D1PaymentRepository } from "#api/infrastructure/payment/repositories/d1-payment-repository.ts";
import { D1InventoryLedger } from "#api/infrastructure/inventory/shared/d1-inventory-ledger.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, expect, it, vi } from "vite-plus/test";
import { storeReader, storeRepositories } from "#api/test/store-reader.ts";
import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { restoreStoredOrderLine } from "#api/infrastructure/order/mappers/restore-stored-order-line.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
const NOW = "2026-10-11T00:00:00.000Z";
let platform: Awaited<
  ReturnType<
    typeof getPlatformProxy<{
      DB: D1Database;
    }>
  >
>;
const ORDER_LINE = { sku: "mug", name: "カップ", quantity: 1, unitPrice: 100 };
let query: ReturnType<typeof storeReader>;
beforeAll(async () => {
  platform = await getPlatformProxy<{
    DB: D1Database;
  }>({
    configPath: join(
      API_DIRECTORY,
      "src/infrastructure/access/repositories/wrangler.access-test.jsonc",
    ),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const source = readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8");
    for (const statement of source.split(
      source.includes("CREATE TRIGGER") ? "--> statement-breakpoint" : ";",
    )) {
      const sql = statement.replace(/--[^\n]*/g, "").trim();
      if (sql) {
        await platform.env.DB.prepare(sql).run();
      }
    }
  }

  for (const tenant of ["seller-a", "seller-b", "disabled"]) {
    await seedSeller(tenant);
  }

  await platform.env.DB.prepare(
    "INSERT INTO product_images (id,tenant_id,products_id,image_key,state,created_at) VALUES ('retired', 'seller-a', 'seller-a', 'private/retired', 'retired', ?)",
  )
    .bind(NOW)
    .run();
  const orders = new D1OrderRepository(platform.env.DB);
  for (const [id, tenantId, customerId] of [
    ["order-a", "seller-a", "customer:buyer"],
    ["order-b", "seller-b", "customer:buyer"],
    ["order-other", "seller-a", "customer:other"],
  ]) {
    await orders.save(
      OrderEntity.place({
        id: id!,
        tenantId: tenantId!,
        customerId: customerId!,
        lines: [restoreStoredOrderLine(ORDER_LINE)],
        now: NOW,
        eventId: crypto.randomUUID(),
      }),
    );
  }

  query = storeReader(platform.env.DB);
}, 30000);
afterAll(async () => {
  await platform?.dispose();
});
it("公開商品一覧 / 商品数にかかわらず3回のSQLで商品・企業・在庫を取得し、画像数でページ境界を変えない", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO product_images (id,tenant_id,products_id,image_key,state,created_at) VALUES ('z-extra', 'seller-a', 'seller-a', 'private/extra', 'active', ?), ('wrong-tenant', 'seller-b', 'seller-a', 'private/wrong', 'active', ?)",
  )
    .bind(NOW, NOW)
    .run();
  await platform.env.DB.prepare(
    "UPDATE product_images SET state='retired' WHERE id='image-seller-b'",
  ).run();
  await platform.env.DB.prepare("UPDATE products SET image_key=NULL WHERE id='seller-b'").run();
  // MiniflareのDBプロキシを直接書き換えず、実DBへ委譲する境界でSQL回数を数える。
  const prepare = vi.fn((statement: string) => platform.env.DB.prepare(statement));
  const measuredQuery = storeReader(
    new Proxy(platform.env.DB, {
      get: (target, property) => (property === "prepare" ? prepare : Reflect.get(target, property)),
    }),
  );
  try {
    for (const limit of [1, 2, 100]) {
      prepare.mockClear();
      const result = await measuredQuery.list(StoreListInputDto.parse({ page: { limit } }));
      expect(prepare).toHaveBeenCalledTimes(3);
      expect(result.items).toHaveLength(Math.min(limit, 2));
      expect(result.items[0]?.images).toEqual([{ id: "image-seller-a" }, { id: "z-extra" }]);
      if (limit > 1) {
        expect(result.items[1]?.images).toEqual([]);
      }

      expect(result.nextCursor).toEqual(limit === 1 ? { createdAt: NOW, id: "seller-a" } : null);
    }

    prepare.mockClear();
    expect(
      (
        await measuredQuery.list(
          StoreListInputDto.parse({ page: { limit: 100 }, search: "存在しない商品" }),
        )
      ).items,
    ).toEqual([]);
    expect(prepare).toHaveBeenCalledTimes(1);
  } finally {
    await platform.env.DB.prepare(
      "UPDATE products SET image_key='private/seller-b' WHERE id='seller-b'",
    ).run();
    await platform.env.DB.prepare(
      "UPDATE product_images SET state='active' WHERE id='image-seller-b'",
    ).run();
    await platform.env.DB.prepare(
      "DELETE FROM product_images WHERE id IN ('z-extra', 'wrong-tenant')",
    ).run();
  }
});
it("公開商品と本人注文のD1照会 / 企業停止後も本人取消でき、既存イベント処理で在庫と決済を再配送安全に戻す", async () => {
  const { repository, inventory, payments, gateway, original, store, buyer } =
    await cancellationFixture();
  await expect(
    store.cancelOrder(
      StoreCancelOrderInputDto.parse({ identity: buyer, id: original.id, version: 9 }),
    ),
  ).rejects.toMatchObject({
    code: "CONFLICT",
  });
  const other = await authorizedActor({
    userId: "customer:other",
    tenantId: "",
    channel: "customer",
    role: "member",
    permissions: [],
  });
  await expect(
    store.cancelOrder(
      StoreCancelOrderInputDto.parse({ identity: other, id: original.id, version: 0 }),
    ),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  const cancelled = await store.cancelOrder(
    StoreCancelOrderInputDto.parse({ identity: buyer, id: original.id, version: 0 }),
  );
  expect(cancelled).toMatchObject({ status: "cancelled", tenantId: "disabled", version: 1 });
  const saved = await repository.find("disabled", original.id);
  expect(saved?.status).toBe("cancelled");
  const pending = await new D1OutboxStore(platform.env.DB).listPending(100);
  const event = pending.find(
    (item) => item.event.name === "order.cancelled" && item.event.aggregateId === original.id,
  )?.event;
  expect(event).toBeDefined();
  const processor = new ProcessOrderEventUseCase(
    repository,
    gateway,
    new OrderPaymentSynchronizationGateway(payments),
  );
  await processor.execute(ProcessOrderEventInputDto.parse({ event: event! }));
  await processor.execute(ProcessOrderEventInputDto.parse({ event: event! }));
  expect((await inventory.findBySku("mug"))?.onHand).toBe(12);
  expect(await orderReader(platform.env.DB).get("disabled", original.id)).toMatchObject({
    paymentStatus: "voided",
  });
});
it("公開商品と本人注文のD1照会 / 企業停止後も出荷済みの本人注文は取消を拒否する", async () => {
  const { repository, original, store, buyer } = await cancellationFixture("shipped-cancel-order");
  const shippedOrder = OrderEntity.place({
    id: "shipped-order",
    tenantId: "disabled",
    customerId: buyer.userId,
    lines: original.toSnapshot().lines.map(restoreStoredOrderLine),
    now: NOW,
    eventId: "shipped-created",
  });
  await repository.save(shippedOrder);
  const shippedSaved = shippedOrder.ship({ now: NOW, eventId: "shipped-event" });
  await repository.update(shippedSaved, shippedOrder.version);
  await expect(
    store.cancelOrder(
      StoreCancelOrderInputDto.parse({
        identity: buyer,
        id: shippedSaved.id,
        version: shippedSaved.version,
      }),
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("公開商品と本人注文のD1照会 / 有効企業の公開フィールドだけを返し、無効企業・R2キー・IP設定を公開しない", async () => {
  const result = await query.list(StoreListInputDto.parse({ page: { limit: 25 } }));
  expect(result.items.map((item) => item.tenantId)).toEqual(["seller-a", "seller-b"]);
  expect(result.items[0]).toMatchObject({
    availableQuantity: 12,
    images: [{ id: "image-seller-a" }],
  });
  expect(JSON.stringify(result)).not.toContain("private/");
  expect(JSON.stringify(result)).not.toContain("private-ip");
  expect(await query.get("disabled", "mug")).toBeNull();
});
it("公開商品と本人注文のD1照会 / 同時刻の商品をDrizzle cursorで重複なく進む", async () => {
  const first = await query.list(StoreListInputDto.parse({ page: { limit: 1 } }));
  expect(first.nextCursor).not.toBeNull();
  const second = await query.list(
    StoreListInputDto.parse({ page: { limit: 1, cursor: first.nextCursor! } }),
  );
  expect(second.items[0]?.tenantId).toBe("seller-b");
  expect(second.nextCursor).toBeNull();
});
it("公開商品と本人注文のD1照会 / 画像は有効企業・商品・active参照すべてを照合する", async () => {
  expect(await query.imageKey("seller-a", "mug", "image-seller-a")).toBe("private/seller-a");
  expect(await query.imageKey("seller-a", "mug", "image-seller-b")).toBeNull();
  expect(await query.imageKey("seller-a", "mug", "retired")).toBeNull();
  expect(await query.imageKey("disabled", "mug", "image-disabled")).toBeNull();
});
it("公開商品と本人注文のD1照会 / 本人注文を企業横断で返し他会員を除外する", async () => {
  const result = await query.listOrders("customer:buyer", { limit: 25 });
  expect(result.items.map((order) => order.id)).toEqual(["order-a", "order-b"]);
  expect(await query.getOrder("customer:buyer", "order-other")).toBeNull();
  expect(await query.getOrder("customer:buyer", "order-b")).toMatchObject({
    tenantId: "seller-b",
  });
});
it("公開商品と本人注文のD1照会 / 企業の注文詳細に現在決済状態を結合し、別企業の決済を混ぜない", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO payments (id,tenant_id,order_id,amount,currency,status,order_version,created_at,updated_at) VALUES ('payment-a', 'seller-a', 'order-a', 100, 'JPY', 'pending', 0, ?, ?)",
  )
    .bind(NOW, NOW)
    .run();
  await platform.env.DB.prepare(
    "INSERT INTO payments (id,tenant_id,order_id,amount,currency,status,order_version,created_at,updated_at) VALUES ('payment-wrong-tenant', 'seller-b', 'order-a', 100, 'JPY', 'failed', 0, ?, ?)",
  )
    .bind(NOW, NOW)
    .run();
  expect(await orderReader(platform.env.DB).get("seller-a", "order-a")).toMatchObject({
    paymentStatus: "pending",
  });
  await platform.env.DB.prepare(
    "UPDATE payments SET status='authorized' WHERE id='payment-a'",
  ).run();
  expect(await orderReader(platform.env.DB).get("seller-a", "order-a")).toMatchObject({
    paymentStatus: "authorized",
  });
  expect(await orderReader(platform.env.DB).get("seller-b", "order-a")).toBeNull();
});
it("公開商品と本人注文のD1照会 / 検索入力をワイルドカードへ変換しない", async () => {
  expect(
    (await query.list(StoreListInputDto.parse({ page: { limit: 25 }, search: "%" }))).items,
  ).toEqual([]);
  expect(
    (await query.list(StoreListInputDto.parse({ page: { limit: 25 }, search: "カップ" }))).items,
  ).toHaveLength(2);
});

async function seedSeller(tenant: string) {
  await platform.env.DB.prepare(
    "INSERT INTO organizations (id,name,active,invitations_enabled,business_allowed_ips) VALUES (?, ?, ?, 0, ?)",
  )
    .bind(tenant, tenant, Number(tenant !== "disabled"), '["10.0.0.0/8"]')
    .run();
  await platform.env.DB.prepare(
    "INSERT INTO products (id,tenant_id,sku,name,unit_price,image_key,created_at) VALUES (?, ?, 'mug', 'カップ', 100, ?, ?)",
  )
    .bind(tenant, tenant, `private/${tenant}`, NOW)
    .run();
  await platform.env.DB.prepare(
    "INSERT INTO product_images (id,tenant_id,products_id,image_key,state,created_at) VALUES (?, ?, ?, ?, 'active', ?)",
  )
    .bind(`image-${tenant}`, tenant, tenant, `private/${tenant}`, NOW)
    .run();
  await platform.env.DB.prepare(
    "INSERT INTO inventory_items (tenant_id,sku,on_hand,updated_at) VALUES (?, 'mug', 12, ?)",
  )
    .bind(tenant, NOW)
    .run();
}

async function cancellationFixture(orderId = "cancel-order") {
  const repository = new D1OrderRepository(platform.env.DB);
  const inventory = new D1InventoryLedger(platform.env.DB, "disabled");
  const payments = new SynchronizePaymentUseCase(new D1PaymentRepository(platform.env.DB));
  const original = OrderEntity.place({
    id: orderId,
    tenantId: "disabled",
    customerId: "customer:cancel-buyer",
    lines: [restoreStoredOrderLine({ sku: "mug", name: "カップ", quantity: 2, unitPrice: 100 })],
    now: NOW,
    eventId: `${orderId}-created`,
  });
  await repository.save(original);
  await inventory.commitAllocation({
    orderId: original.id,
    sku: "mug",
    quantity: 2,
    onHand: 10,
    committedAt: NOW,
  });
  await payments.execute(SynchronizePaymentInputDto.parse(original.toSnapshot()));
  const gateway: InventoryGateway = {
    reserve: async () => {},
    release: async () => {},
    commit: async () => {},
    cancel: (input) => inventory.restoreAllocation({ ...input, now: NOW }),
  };
  const orderProducts = new D1ProductRepository(platform.env.DB);
  const store = new StoreUseCase(
    storeRepositories(platform.env.DB),
    { get: async () => null, put: async () => {}, delete: async () => {} },
    new CreateOrderUseCase(repository, gateway, orderProducts),
    new ManageOrderUseCase(repository, gateway, orderProducts),
  );
  const buyer = await authorizedActor({
    userId: "customer:cancel-buyer",
    tenantId: "",
    channel: "customer",
    role: "member",
    permissions: [],
  });
  return { repository, inventory, payments, gateway, original, store, buyer };
}
