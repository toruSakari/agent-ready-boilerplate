import { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import type { StockAdjustmentSnapshot } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { D1DoInventoryRepository } from "#api/infrastructure/inventory/repositories/d1-do-inventory-repository.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import { InventoryReservation } from "#api/infrastructure/inventory/durable-objects/inventory-reservation.ts";
import { D1StockAdjustmentRepository } from "#api/infrastructure/inventory/repositories/d1-stock-adjustment-repository.ts";
import { stockHistoryReader } from "#api/test/stock-history-reader.ts";
import { INVENTORY_TENANT_HEADER } from "#api/infrastructure/inventory/shared/inventory-scope.ts";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState) {}
  },
}));
const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
const TENANT = "stock-tenant";
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(new URL("./wrangler.inventory-test.jsonc", import.meta.url)),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((name) => name.endsWith(".sql"))
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
}, 30000);
afterAll(async () => {
  await platform?.dispose();
});
beforeEach(async () => {
  await platform.env.DB.prepare("DELETE FROM inventory_adjustments").run();
  await platform.env.DB.prepare("DELETE FROM inventory_items").run();
  await platform.env.DB.prepare(
    "INSERT INTO inventory_items (tenant_id, sku, on_hand, updated_at) VALUES (?, 'S1', 3, '2026-10-01')",
  )
    .bind(TENANT)
    .run();
});

function inventory() {
  const storage = new Map<string, unknown>();
  let tail: Promise<unknown> = Promise.resolve();
  const ctx = {
    blockConcurrencyWhile: (callback: () => Promise<unknown>) => {
      const result = tail.then(callback);
      tail = result.catch(() => {});
      return result;
    },
    storage: {
      get: async (key: string) => storage.get(key),
      put: async (key: string, value: unknown) => {
        storage.set(key, value);
      },
      delete: async (keys: string | string[]) => {
        for (const key of typeof keys === "string" ? [keys] : keys) {
          storage.delete(key);
        }
      },
      list: async (props: { prefix: string }) =>
        new Map([...storage].filter((inputProps) => inputProps[0].startsWith(props.prefix))),
    },
  } as unknown as DurableObjectState;
  const instance = new InventoryReservation(ctx, platform.env);
  return (path: string, body: object, tenantId = TENANT) =>
    instance.fetch(
      new Request(`https://inventory${path}`, {
        method: "POST",
        headers: { [INVENTORY_TENANT_HEADER]: tenantId },
        body: JSON.stringify(body),
      }),
    );
}

function receipt(quantity = 10, operationId = crypto.randomUUID()) {
  return {
    operationId,
    sku: "S1",
    actorId: "business:staff",
    adjustment: { operation: "receive", quantity, reason: "delivery" },
  };
}

async function stock() {
  return platform.env.DB.prepare(
    "SELECT on_hand FROM inventory_items WHERE tenant_id = ? AND sku = 'S1'",
  )
    .bind(TENANT)
    .first<{
      on_hand: number;
    }>();
}

it("入荷の再試行は二重加算せず、同じIDの内容変更を拒否する", async () => {
  const call = inventory();
  const input = receipt();
  expect((await call("/adjustments", input)).status).toBe(200);
  expect((await call("/adjustments", input)).status).toBe(200);
  expect(await stock()).toEqual({ on_hand: 13 });
  expect(
    (await call("/adjustments", { ...input, adjustment: { ...input.adjustment, quantity: 20 } }))
      .status,
  ).toBe(409);
  expect(
    await stockHistoryReader(platform.env.DB).history(TENANT, "S1", { limit: 25 }),
  ).toHaveLength(1);
});
it("同時入荷は加算を失わず、履歴の前後数量も連続する", async () => {
  const call = inventory();
  expect(
    (await Promise.all([call("/adjustments", receipt(10)), call("/adjustments", receipt(5))])).map(
      (r) => r.status,
    ),
  ).toEqual([200, 200]);
  expect(await stock()).toEqual({ on_hand: 18 });
  const history = await stockHistoryReader(platform.env.DB).history(TENANT, "S1", {
    limit: 25,
  });
  expect(history.map((r) => [r.beforeStock, r.afterStock])).toEqual(
    expect.arrayContaining([
      [3, 13],
      [13, 18],
    ]),
  );
});
it("古い棚卸しと予約数未満への変更は履歴も在庫も書き込まない", async () => {
  const call = inventory();
  expect((await call("/reservations", { sku: "S1", orderId: "o1", quantity: 2 })).status).toBe(201);
  const metadata = { operationId: crypto.randomUUID(), sku: "S1", actorId: "business:staff" };
  const adjustment = { operation: "recount", quantity: 1, expectedStock: 3, reason: "stocktake" };
  const reserved = await call("/adjustments", { ...metadata, adjustment });
  expect(await reserved.json()).toEqual({ reason: "STOCK_RESERVED" });
  const stale = await call("/adjustments", {
    ...metadata,
    adjustment: { ...adjustment, expectedStock: 2 },
  });
  expect(await stale.json()).toEqual({ reason: "STOCK_CHANGED" });
  expect(await stock()).toEqual({ on_hand: 3 });
  expect(await stockHistoryReader(platform.env.DB).history(TENANT, "S1", { limit: 25 })).toEqual(
    [],
  );
});
it("履歴保存の失敗は在庫を変更せず、同じIDで復旧できる", async () => {
  const call = inventory();
  const input = receipt();
  await platform.env.DB.prepare(
    "CREATE TRIGGER reject_stock_history BEFORE INSERT ON inventory_adjustments BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  ).run();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await call("/adjustments", input)).status).toBe(500);
  } finally {
    log.mockRestore();
  }

  expect(await stock()).toEqual({ on_hand: 3 });
  await platform.env.DB.prepare("DROP TRIGGER reject_stock_history").run();
  expect((await call("/adjustments", input)).status).toBe(200);
  expect(await stock()).toEqual({ on_hand: 13 });
});
it("在庫保存の失敗は履歴もロールバックする", async () => {
  const call = inventory();
  const input = receipt();
  await platform.env.DB.prepare(
    "CREATE TRIGGER reject_stock_update BEFORE UPDATE ON inventory_items BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  ).run();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await call("/adjustments", input)).status).toBe(500);
  } finally {
    log.mockRestore();
  }

  expect(
    await new D1StockAdjustmentRepository(platform.env.DB).find(TENANT, input.operationId),
  ).toBeNull();
  expect(await stock()).toEqual({ on_hand: 3 });
  await platform.env.DB.prepare("DROP TRIGGER reject_stock_update").run();
  expect((await call("/adjustments", input)).status).toBe(200);
  expect(await stock()).toEqual({ on_hand: 13 });
});
it("履歴と操作IDは企業ごとに分離され、同じ企業でも別SKUを混ぜない", async () => {
  const call = inventory();
  const input = receipt();
  await call("/adjustments", input);
  expect(
    await new D1StockAdjustmentRepository(platform.env.DB).find("other", input.operationId),
  ).toBeNull();
  const query = stockHistoryReader(platform.env.DB);
  expect(await query.history("other", "S1", { limit: 25 })).toEqual([]);
  expect(await query.history(TENANT, "S2", { limit: 25 })).toEqual([]);
  expect((await call("/adjustments", input, "other")).status).toBe(409);
});
it("履歴は同時刻もIDでページを越え、削除済みの境界にも依存しない", async () => {
  const repository = adjustmentRepository();
  let onHand = 3;
  for (const id of ["a", "b", "c"]) {
    const { item, entry } = adjustmentEntities({ id, beforeStock: onHand });
    await repository.saveAdjustment(item, entry);
    onHand = item.onHand;
  }

  const query = stockHistoryReader(platform.env.DB);
  const [first] = await query.history(TENANT, "S1", { limit: 1 });
  expect(first.id).toBe("a");
  await platform.env.DB.prepare("DELETE FROM inventory_adjustments WHERE id = 'a'").run();
  expect(
    (
      await query.history(TENANT, "S1", {
        limit: 2,
        cursor: { id: first.id, createdAt: first.createdAt },
      })
    ).map((r) => r.id),
  ).toEqual(["b", "c"]);
});
it("履歴の氏名は同企業の在籍企業会員に限定し、所属解除後は返さない", async () => {
  const db = platform.env.DB;
  await db
    .prepare(
      "INSERT INTO organizations (id, name, active, invitations_enabled) VALUES (?, '企業', 1, 1)",
    )
    .bind(TENANT)
    .run();
  await db
    .prepare(
      "INSERT INTO access_roles (id, scope, name, protected_role) VALUES ('history-role', ?, '担当者', 0)",
    )
    .bind(TENANT)
    .run();
  await db
    .prepare(
      "INSERT INTO business_accounts (id, subject_id, name, email, deleted) VALUES ('business:staff', 'staff-subject', '担当者A', 'private@example.com', 0)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO business_memberships (id, organizations_id, business_accounts_id, access_roles_id) VALUES ('business:history', ?, 'business:staff', 'history-role')",
    )
    .bind(TENANT)
    .run();
  await inventory()("/adjustments", receipt());
  const query = stockHistoryReader(db);
  const [entry] = await query.history(TENANT, "S1", { limit: 25 });
  expect(entry.actorName).toBe("担当者A");
  expect(entry).not.toHaveProperty("actorId");
  expect(JSON.stringify(entry)).not.toContain("private@example.com");
  await db.prepare("DELETE FROM business_memberships WHERE id = 'business:history'").run();
  expect((await query.history(TENANT, "S1", { limit: 25 }))[0].actorName).toBeNull();
});
it("在庫一覧は企業を分離し、日時・IDのカーソルで次の商品を取得する", async () => {
  const db = platform.env.DB;
  for (const [id, tenantId] of [
    ["a", TENANT],
    ["b", TENANT],
    ["other", "other"],
  ]) {
    await db
      .prepare(
        "INSERT INTO products (id, tenant_id, sku, name, unit_price, created_at) VALUES (?, ?, ?, '商品', 100, '2026-10-01T00:00:00Z')",
      )
      .bind(id, tenantId, id)
      .run();
  }

  const query = new D1ProductRepository(db);
  const [first] = await query.list(TENANT, { limit: 1 });
  expect(first.id).toBe("a");
  expect(
    (
      await query.list(TENANT, { limit: 25, cursor: { id: first.id, createdAt: first.createdAt } })
    ).map((p) => p.id),
  ).toEqual(["b"]);
});

function adjustmentRepository() {
  return new D1DoInventoryRepository(platform.env.DB, {} as DurableObjectStorage, TENANT, "legacy");
}

function adjustmentEntities(input: { id?: string; beforeStock?: number } = {}) {
  const current = InventoryItem.restore({
    sku: Sku.create("S1"),
    onHand: StockQuantity.create(input.beforeStock ?? 3),
    reservations: [],
  });
  const item = current.changeStock({
    onHand: StockQuantity.create(current.onHand + 1),
    now: "2026-10-01T00:00:00Z",
    eventId: input.id ?? crypto.randomUUID(),
  });
  const entry = StockAdjustmentEntry.create({
    id: item.events[0]!.id,
    tenantId: TENANT,
    sku: item.sku,
    actorId: "business:staff",
    operation: "receive",
    reason: "delivery",
    quantity: StockQuantity.create(1),
    beforeStock: current.onHand,
    afterStock: item.onHand,
    expectedStock: null,
    createdAt: "2026-10-01T00:00:00Z",
  });
  return { current, item, entry };
}

it("棚卸しは確認した在庫から更新し、同じ操作の再試行は最新在庫と予約を返す", async () => {
  const call = inventory();
  await call("/reservations", { sku: "S1", orderId: "o1", quantity: 2 });
  const input = {
    operationId: crypto.randomUUID(),
    sku: "S1",
    actorId: "business:staff",
    adjustment: { operation: "recount", quantity: 5, expectedStock: 3, reason: "stocktake" },
  };
  expect(await (await call("/adjustments", input)).json()).toEqual({
    stock: 5,
    reserved: 2,
    available: 3,
  });
  await call("/adjustments", receipt(2));
  expect(await (await call("/adjustments", input)).json()).toEqual({
    stock: 7,
    reserved: 2,
    available: 5,
  });
  expect(await stock()).toEqual({ on_hand: 7 });
  expect(
    await new D1StockAdjustmentRepository(platform.env.DB).find(TENANT, input.operationId),
  ).toBeInstanceOf(StockAdjustmentEntry);
  expect(
    await stockHistoryReader(platform.env.DB).history(TENANT, "S1", { limit: 25 }),
  ).toHaveLength(2);
});

it("Repositoryは変更後のEntityと履歴を保存し、同じ操作IDを再適用しない", async () => {
  const repository = adjustmentRepository();
  const { item, entry } = adjustmentEntities();
  await repository.saveAdjustment(item, entry);
  expect(await stock()).toEqual({ on_hand: 4 });
  const stored = await new D1StockAdjustmentRepository(platform.env.DB).find(TENANT, entry.id);
  expect(stored).toBeInstanceOf(StockAdjustmentEntry);
  expect(stored?.toSnapshot()).toEqual(entry.toSnapshot());
  const repeated = adjustmentEntities({ id: entry.id, beforeStock: 4 });
  await expect(repository.saveAdjustment(repeated.item, repeated.entry)).rejects.toThrow();
  expect(await stock()).toEqual({ on_hand: 4 });
  expect(
    await stockHistoryReader(platform.env.DB).history(TENANT, "S1", { limit: 25 }),
  ).toHaveLength(1);
});

it.each([
  { label: "企業", change: { tenantId: "other" } },
  { label: "SKU", change: { sku: Sku.create("S2") } },
  { label: "操作ID", change: { id: "other" } },
  { label: "日時", change: { createdAt: "2026-10-02T00:00:00Z" } },
  {
    label: "変更前",
    change: { beforeStock: StockQuantity.create(2), quantity: StockQuantity.create(2) },
  },
  {
    label: "変更後",
    change: { afterStock: StockQuantity.create(5), quantity: StockQuantity.create(2) },
  },
])("在庫と履歴の$labelが異なる場合は何も保存しない", async (input) => {
  const { item, entry } = adjustmentEntities();
  const changed: StockAdjustmentSnapshot = { ...entry.toSnapshot(), ...input.change };
  await expect(
    adjustmentRepository().saveAdjustment(item, StockAdjustmentEntry.create(changed)),
  ).rejects.toThrow();
  expect(await stock()).toEqual({ on_hand: 3 });
  expect(await new D1StockAdjustmentRepository(platform.env.DB).find(TENANT, entry.id)).toBeNull();
  expect(await stockHistoryReader(platform.env.DB).history(TENANT, "S1", { limit: 25 })).toEqual(
    [],
  );
});

it("変更なし・予約操作のEntityを在庫調整の履歴と保存できない", async () => {
  const { current, entry } = adjustmentEntities();
  const reserved = current.reserve({
    orderId: "reserved",
    quantity: ReservationQuantity.create(1),
    now: "2026-10-01T00:00:00Z",
    eventId: entry.id,
  });
  const repository = adjustmentRepository();
  await expect(repository.saveAdjustment(current, entry)).rejects.toThrow();
  await expect(repository.saveAdjustment(reserved, entry)).rejects.toThrow();
  expect(await stock()).toEqual({ on_hand: 3 });
  expect(await new D1StockAdjustmentRepository(platform.env.DB).find(TENANT, entry.id)).toBeNull();
});

it("履歴の不正な数量は復元済みEntityとして返さない", async () => {
  const { item, entry } = adjustmentEntities();
  await adjustmentRepository().saveAdjustment(item, entry);
  await platform.env.DB.prepare(
    "UPDATE inventory_adjustments SET after_stock = -1 WHERE tenant_id = ?",
  )
    .bind(TENANT)
    .run();
  await expect(
    new D1StockAdjustmentRepository(platform.env.DB).find(TENANT, entry.id),
  ).rejects.toThrow("在庫変更履歴の復元に失敗しました");
});
