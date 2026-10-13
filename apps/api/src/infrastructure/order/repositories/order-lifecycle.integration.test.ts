import { ManageOrderInputDto } from "#api/application/order/dtos/manage-order-input-dto.ts";
import { SynchronizePaymentInputDto } from "#api/application/payment/dtos/synchronize-payment-input-dto.ts";
// @vitest-environment node
import { orderReader } from "#api/test/order-reader.ts";
import { D1OutboxStore } from "#api/infrastructure/order/messaging/d1-outbox-store.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import { BUSINESS_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import { restoreStoredOrderLine } from "#api/infrastructure/order/mappers/restore-stored-order-line.ts";
import { orderValues } from "#api/test/domain-values.ts";
import { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { D1InventoryLedger } from "#api/infrastructure/inventory/shared/d1-inventory-ledger.ts";
import { D1PaymentRepository } from "#api/infrastructure/payment/repositories/d1-payment-repository.ts";
import { SynchronizePaymentUseCase } from "#api/application/payment/use-cases/synchronize-payment-use-case.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let orders: D1OrderRepository;
let orderQuery: ReturnType<typeof orderReader>;
let outbox: D1OutboxStore;
let migratedStock: Awaited<ReturnType<D1InventoryLedger["findBySku"]>>;
let migratedOrders: Awaited<ReturnType<ReturnType<typeof orderReader>["list"]>>;
const legacyStatuses = ["draft", "confirmed", "shipped", "completed", "cancelled"] as const;
const input = {
  id: "o1",
  tenantId: "t1",
  customerId: "u1",
  lines: [{ sku: "s1", name: "マグ", quantity: 2, unitPrice: 500 }],
  now: "2026-10-02",
  eventId: "created",
};
beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(new URL("./wrangler.order-test.jsonc", import.meta.url)),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    if (file.startsWith("0004_")) {
      await seedLegacyOrders();
    }

    if (file.startsWith("0014_")) {
      await seedLegacyAccountMapping();
    }

    for (const statement of readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8").split(
      file.startsWith("0014_") ? "--> statement-breakpoint" : ";",
    )) {
      const sql = statement.replace(/--[^\n]*/g, "").trim();
      if (sql) {
        await platform.env.DB.prepare(sql).run();
      }
    }
  }

  orders = new D1OrderRepository(platform.env.DB);
  orderQuery = orderReader(platform.env.DB);
  outbox = new D1OutboxStore(platform.env.DB);
  migratedOrders = await orderQuery.list("legacy");
  migratedStock = await new D1InventoryLedger(platform.env.DB).findBySku("SKU-EDGE-MUG");
}, 30000);
afterAll(async () => {
  await platform?.dispose();
});
beforeEach(async () => {
  for (const table of [
    "order_status_assignments",
    "orders",
    "outbox_events",
    "payments",
    "inventory_allocations",
    "inventory_items",
  ]) {
    await platform.env.DB.prepare(`DELETE FROM ${table}`).run();
  }

  await platform.env.DB.prepare(
    "INSERT INTO order_statuses (code, name, sort_order) VALUES ('confirmed', '確定', 20) ON CONFLICT (code) DO NOTHING",
  ).run();
  await platform.env.DB.prepare(
    "UPDATE order_statuses SET name = '下書き' WHERE code = 'draft'",
  ).run();
});
it("ローカルD1での注文整合性 / 既存在庫を企業単位の複合主キーへ移行して保持する", () => {
  expect(migratedStock).toMatchObject({ sku: "SKU-EDGE-MUG", onHand: 25 });
});
it("ローカルD1での注文整合性 / 同じSKU・割当IDでも別企業の在庫・取消に影響しない", async () => {
  const first = new D1InventoryLedger(platform.env.DB, "company-a");
  const second = new D1InventoryLedger(platform.env.DB, "company-b");
  await first.save({ sku: "shared-sku", onHand: 10, updatedAt: input.now });
  await second.save({ sku: "shared-sku", onHand: 20, updatedAt: input.now });
  await first.commitAllocation({
    orderId: "same-order",
    sku: "shared-sku",
    quantity: 2,
    onHand: 8,
    committedAt: input.now,
  });
  expect((await second.findBySku("shared-sku"))?.onHand).toBe(20);
  expect(await second.findAllocation({ orderId: "same-order", sku: "shared-sku" })).toBeNull();
  await second.restoreAllocation({ orderId: "same-order", sku: "shared-sku", now: input.now });
  expect((await second.findBySku("shared-sku"))?.onHand).toBe(20);
  await second.commitAllocation({
    orderId: "same-order",
    sku: "shared-sku",
    quantity: 3,
    onHand: 17,
    committedAt: input.now,
  });
  await first.restoreAllocation({ orderId: "same-order", sku: "shared-sku", now: input.now });
  expect((await first.findBySku("shared-sku"))?.onHand).toBe(10);
  expect((await second.findBySku("shared-sku"))?.onHand).toBe(17);
});
it("ローカルD1での注文整合性 / 取得時にエンティティを復元し、そのまま状態遷移して保存できる", async () => {
  await orders.save(OrderEntity.draft(orderValues(input)));
  const loaded = await orders.find("t1", "o1");
  expect(loaded).toBeInstanceOf(OrderEntity);
  if (!loaded || loaded.status !== "draft") {
    throw new Error("下書きが取得できません");
  }

  expect(loaded.events).toEqual([]);
  expect(loaded.lines[0]?.quantity).toBe(2);
  expect(
    await orders.update(loaded.confirm({ now: input.now, eventId: "confirmed" }), loaded.version),
  ).toBe(true);
  expect((await orders.find("t1", "o1"))?.status).toBe("confirmed");
});
it("ローカルD1での注文整合性 / 不正な保存データはRepositoryの取得時に拒否する", async () => {
  await orders.save(OrderEntity.draft(orderValues(input)));
  await platform.env.DB.prepare("UPDATE orders SET total = 1 WHERE id = ?").bind(input.id).run();
  await expect(orders.find("t1", "o1")).rejects.toThrow("注文の合計金額・更新番号が不正です");
});
it("ローカルD1での注文整合性 / 既存の全ステータスを中間テーブルへ移行し、旧列を削除する", async () => {
  expect(migratedOrders).toHaveLength(5);
  expect(migratedOrders.map((order) => order.status).sort()).toEqual([...legacyStatuses].sort());
  expect(
    migratedOrders.every(
      (order) => order.version === 7 && order.total === 1000 && order.statusLabel,
    ),
  ).toBe(true);
  const columns = await platform.env.DB.prepare("PRAGMA table_info(orders)").all<{
    name: string;
  }>();
  expect(columns.results.map((column) => column.name)).not.toContain("status");
});
it("ローカルD1での注文整合性 / ステータス名をDBマスタから取得し、注文に二つの現在状態を登録できない", async () => {
  await orders.save(OrderEntity.draft(orderValues(input)));
  await platform.env.DB.prepare(
    "UPDATE order_statuses SET name = '編集中' WHERE code = 'draft'",
  ).run();
  expect((await orderQuery.list("t1"))[0]?.statusLabel).toBe("編集中");
  await expect(
    platform.env.DB.prepare(
      "INSERT INTO order_status_assignments (orders_id, order_statuses_id, updated_at) VALUES ('o1', 'confirmed', '2026-10-03')",
    ).run(),
  ).rejects.toThrow();
  await expect(
    platform.env.DB.prepare(
      "UPDATE order_status_assignments SET order_statuses_id = 'unknown' WHERE orders_id = 'o1'",
    ).run(),
  ).rejects.toThrow();
  expect((await orders.find("t1", "o1"))?.status).toBe("draft");
});
it("ローカルD1での注文整合性 / 中間テーブルの状態更新失敗は注文番号とOutboxもロールバックする", async () => {
  const draft = OrderEntity.draft(orderValues(input));
  await orders.save(draft);
  await platform.env.DB.prepare("DELETE FROM order_statuses WHERE code = 'confirmed'").run();
  const next = draft.confirm({ now: input.now, eventId: "confirmed" });
  await expect(orders.update(next, 0)).rejects.toThrow();
  expect((await orders.find("t1", "o1"))?.version).toBe(0);
  expect((await orders.find("t1", "o1"))?.status).toBe("draft");
  expect(await outbox.listPending(20)).toHaveLength(1);
});
it("ローカルD1での注文整合性 / 競合した更新は保存もOutbox追加もせず、別テナントから見えない", async () => {
  const draft = OrderEntity.draft(orderValues(input));
  await orders.save(draft);
  const first = draft.update([restoreStoredOrderLine({ ...input.lines[0]!, quantity: 3 })], {
    now: "2026-10-03",
    eventId: "first",
  });
  const second = draft.update([restoreStoredOrderLine({ ...input.lines[0]!, quantity: 4 })], {
    now: "2026-10-03",
    eventId: "second",
  });
  expect(await orders.update(first, 0)).toBe(true);
  expect(await orders.update(second, 0)).toBe(false);
  expect((await orders.find("t1", "o1"))?.total).toBe(1500);
  expect(await orders.find("t2", "o1")).toBeNull();
  expect(await orderQuery.list("t2")).toEqual([]);
  expect((await outbox.listPending(20)).map((item) => item.id)).toEqual(["created", "first"]);
});
it("ローカルD1での注文整合性 / 更新競合の敗者は中間テーブルのステータスを上書きしない", async () => {
  const draft = OrderEntity.draft(orderValues(input));
  await orders.save(draft);
  const cancelled = draft.cancel({ now: input.now, eventId: "winner" });
  const confirmed = draft.confirm({ now: input.now, eventId: "loser" });
  expect(await orders.update(cancelled, 0)).toBe(true);
  expect(await orders.update(confirmed, 0)).toBe(false);
  expect((await orders.find("t1", "o1"))?.status).toBe("cancelled");
  expect((await outbox.listPending(20)).map((item) => item.id)).toEqual(["created", "winner"]);
});
it("ローカルD1での注文整合性 / Outbox書き込み失敗は注文更新もロールバックする", async () => {
  const draft = OrderEntity.draft(orderValues(input));
  await orders.save(draft);
  const next = draft.update([restoreStoredOrderLine({ ...input.lines[0]!, quantity: 3 })], {
    now: input.now,
    eventId: "created",
  });
  await expect(orders.update(next, 0)).rejects.toThrow();
  expect((await orders.find("t1", "o1"))?.version).toBe(0);
  expect((await orders.find("t1", "o1"))?.total).toBe(1000);
});
it("ローカルD1での注文整合性 / キャンセルした下書きに予約IDを捏造しない", async () => {
  const draft = OrderEntity.draft(orderValues(input));
  await orders.save(draft);
  await orders.update(draft.cancel({ now: input.now, eventId: "cancelled" }), 0);
  expect((await orders.find("t1", "o1"))?.reservationId).toBeNull();
});
it("ローカルD1での注文整合性 / 確定済み在庫の取消は再実行しても一度だけ現在庫を戻す", async () => {
  const inventory = new D1InventoryLedger(platform.env.DB);
  await inventory.save({ sku: "s1", onHand: 10, updatedAt: input.now });
  await inventory.commitAllocation({
    orderId: "reservation1",
    sku: "s1",
    quantity: 2,
    onHand: 8,
    committedAt: input.now,
  });
  const allocated = await inventory.findAllocation({ orderId: "reservation1", sku: "s1" });
  expect(allocated).toBeInstanceOf(StockReservationEntity);
  expect(allocated?.status).toBe("committed");
  expect(allocated?.quantity).toBe(2);
  await inventory.restoreAllocation({ orderId: "reservation1", sku: "s1", now: input.now });
  await inventory.restoreAllocation({ orderId: "reservation1", sku: "s1", now: input.now });
  expect((await inventory.findBySku("s1"))?.onHand).toBe(10);
  expect((await inventory.findAllocation({ orderId: "reservation1", sku: "s1" }))?.status).toBe(
    "restored",
  );
  expect(await inventory.isAllocationCommitted({ orderId: "reservation1", sku: "s1" })).toBe(true);
});
it("ローカルD1での注文整合性 / 決済の承認・取消を保存し、遅れた承認イベントで取消を戻さない", async () => {
  const placed = OrderEntity.place(orderValues(input));
  await orders.save(placed);
  const payments = new SynchronizePaymentUseCase(new D1PaymentRepository(platform.env.DB));
  await payments.execute(SynchronizePaymentInputDto.parse(placed.toSnapshot()));
  expect((await orderQuery.list("t1"))[0]?.paymentStatus).toBe("authorized");
  const cancelled = placed.cancel({ now: input.now, eventId: "cancelled" });
  await orders.update(cancelled, 0);
  await payments.execute(SynchronizePaymentInputDto.parse(cancelled.toSnapshot()));
  await payments.execute(SynchronizePaymentInputDto.parse(placed.toSnapshot()));
  expect((await orderQuery.list("t1"))[0]?.paymentStatus).toBe("voided");
});
it("ローカルD1での注文整合性 / 出荷時にデモ決済を売上確定し、重複処理で増えない", async () => {
  const placed = OrderEntity.place(orderValues(input));
  await orders.save(placed);
  const shipped = placed.ship({ now: input.now, eventId: "shipped" });
  await orders.update(shipped, 0);
  const payments = new SynchronizePaymentUseCase(new D1PaymentRepository(platform.env.DB));
  await payments.execute(SynchronizePaymentInputDto.parse(shipped.toSnapshot()));
  await payments.execute(SynchronizePaymentInputDto.parse(shipped.toSnapshot()));
  expect((await orderQuery.list("t1"))[0]?.paymentStatus).toBe("captured");
  const result = await platform.env.DB.prepare("SELECT COUNT(*) AS count FROM payments").first<{
    count: number;
  }>();
  expect(result?.count).toBe(1);
});
it("ローカルD1での注文整合性 / 同時確定は一件だけ成功し、負けた試行の予約だけを解放する", async () => {
  await orders.save(OrderEntity.draft(orderValues(input)));
  let open!: () => void;
  // 両試行が予約を確保するまで保存へ進ませず、同じ版からの更新競合を確実に作る。
  const barrier = new Promise<void>((resolve) => {
    open = resolve;
  });
  const reservationIds: string[] = [];
  const inventory = {
    reserve: vi.fn<InventoryGateway["reserve"]>(async (reservation) => {
      reservationIds.push(reservation.orderId);
      if (reservationIds.length === 2) {
        open();
      }

      await barrier;
    }),
    release: vi.fn<InventoryGateway["release"]>().mockResolvedValue(undefined),
    cancel: vi.fn<InventoryGateway["cancel"]>(),
    commit: vi.fn<InventoryGateway["commit"]>(),
  } satisfies InventoryGateway;
  const manager = new ManageOrderUseCase(orders, inventory, { findBySkus: async () => [] });
  const change = {
    identity: {
      userId: "u1",
      tenantId: "t1",
      role: "admin" as const,
      permissions: BUSINESS_PERMISSIONS,
    },
    id: "o1",
    version: 0,
    status: "confirmed" as const,
  };
  const first = { ...change, identity: await authorizedActor(change.identity) };
  const second = { ...change, identity: await authorizedActor(change.identity) };
  const results = await Promise.allSettled([
    manager.execute(ManageOrderInputDto.parse({ input: first })),
    manager.execute(ManageOrderInputDto.parse({ input: second })),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const failed = results.find((result) => result.status === "rejected");
  expect(failed).toMatchObject({ reason: { code: "CONFLICT" } });
  expect(new Set(reservationIds).size).toBe(2);
  const saved = await orders.find("t1", "o1");
  expect(saved?.version).toBe(1);
  expect(inventory.release).toHaveBeenCalledTimes(1);
  expect(inventory.release.mock.calls[0]![0].orderId).not.toBe(saved?.reservationId);
  expect(await outbox.listPending(20)).toHaveLength(2);
});
it("注文ページを安定順序で取得し、他顧客・他企業を混ぜない", async () => {
  for (const [id, tenantId, customerId] of [
    ["a-own", "t1", "u1"],
    ["b-other-customer", "t1", "u2"],
    ["c-own", "t1", "u1"],
    ["d-other-tenant", "t2", "u1"],
  ]) {
    await orders.save(
      OrderEntity.draft(
        orderValues({
          ...input,
          id: id!,
          tenantId: tenantId!,
          customerId: customerId!,
          eventId: `event-${id}`,
        }),
      ),
    );
  }

  expect((await orderQuery.list("t1", "u1", { limit: 1 })).map((order) => order.id)).toEqual([
    "a-own",
  ]);
  expect(
    (
      await orderQuery.list("t1", "u1", { limit: 1, cursor: { createdAt: input.now, id: "a-own" } })
    ).map((order) => order.id),
  ).toEqual(["c-own"]);
  expect(
    await orderQuery.list("t1", "u1", { limit: 1, cursor: { createdAt: input.now, id: "c-own" } }),
  ).toEqual([]);
});
it("注文ページの境界が削除され、新しい注文が追加されても続きが重複しない", async () => {
  for (const id of ["a-boundary", "b-next", "c-last"]) {
    await orders.save(OrderEntity.draft(orderValues({ ...input, id, eventId: `created-${id}` })));
  }

  const first = (await orderQuery.list("t1", "u1", { limit: 1 }))[0]!;
  await platform.env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(first.id).run();
  await orders.save(
    OrderEntity.draft(
      orderValues({ ...input, id: "new", now: "2026-10-03", eventId: "created-new" }),
    ),
  );
  const second = await orderQuery.list("t1", "u1", {
    limit: 2,
    cursor: { createdAt: first.createdAt, id: first.id },
  });
  expect(second.map((order) => order.id)).toEqual(["b-next", "c-last"]);
  const newest = await orderQuery.list("t1", "u1", { limit: 1 });
  expect(newest[0]!.id).toBe("new");
  const query = await platform.env.DB.prepare(
    "EXPLAIN QUERY PLAN SELECT id FROM orders WHERE tenant_id = ? AND customer_id = ? ORDER BY created_at DESC, id LIMIT 1",
  )
    .bind("t1", "u1")
    .all();
  expect(JSON.stringify(query.results)).toContain("orders_customer_cursor_idx");
  expect(JSON.stringify(query.results)).not.toContain("TEMP B-TREE");
});
it("注文の商品照会はSKUが同じでも企業を越えて価格を取得しない", async () => {
  const sku = `pricing-${crypto.randomUUID()}`;
  for (const [tenant, price] of [
    ["price-a", 0],
    ["price-b", 2400],
  ] as const) {
    await platform.env.DB.prepare(
      "INSERT INTO products (id, tenant_id, sku, name, unit_price, image_key, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)",
    )
      .bind(crypto.randomUUID(), tenant, sku, "価格検証商品", price, input.now)
      .run();
  }

  const products = new D1ProductRepository(platform.env.DB);
  expect(await products.findBySkus("price-a", [Sku.create(sku)])).toMatchObject([
    { sku, name: "価格検証商品", unitPrice: 0 },
  ]);
  expect(await products.findBySkus("price-b", [Sku.create(sku)])).toMatchObject([
    { sku, name: "価格検証商品", unitPrice: 2400 },
  ]);
  expect(await products.findBySkus("price-other", [Sku.create(sku)])).toEqual([]);
});

async function seedLegacyOrders() {
  for (const status of legacyStatuses) {
    await platform.env.DB.prepare(
      "INSERT INTO orders (id, tenant_id, customer_id, status, lines, total, created_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        `legacy:${status}`,
        "legacy",
        "u1",
        status,
        JSON.stringify(input.lines),
        1000,
        input.now,
        7,
      )
      .run();
  }
}

async function seedLegacyAccountMapping() {
  // この旧fixtureの顧客は一人なので対応を明示する。
  // 本番移行の帰属不明時の拒否条件を、テスト都合で緩めない。
  for (const statement of readFileSync(
    join(API_DIRECTORY, "tooling/service-account-migration-map.sql"),
    "utf8",
  ).split("--> statement-breakpoint")) {
    const sql = statement.replace(/--[^\n]*/g, "").trim();
    if (sql) {
      await platform.env.DB.prepare(sql).run();
    }
  }

  await platform.env.DB.batch([
    platform.env.DB.prepare(
      "INSERT INTO accounts(id,name,email,deleted) VALUES ('u1','過去の顧客',NULL,1)",
    ),
    platform.env.DB.prepare(
      "INSERT INTO service_account_migration_map(id,legacy_account_id,category,account_id,subject_id,reviewed_by,reviewed_at) VALUES ('fixture:u1','u1','customer','customer:legacy-u1','u1','order-fixture','2026-10-04T00:00:00.000Z')",
    ),
    platform.env.DB.prepare(
      "INSERT INTO service_order_migration_map(orders_id,account_id,reviewed_by,reviewed_at) SELECT id,'customer:legacy-u1','order-fixture','2026-10-04T00:00:00.000Z' FROM orders",
    ),
  ]);
}
