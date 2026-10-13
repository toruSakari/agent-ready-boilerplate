// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import { INVENTORY_TENANT_HEADER } from "#api/infrastructure/inventory/shared/inventory-scope.ts";
import { InventoryReservation } from "#api/infrastructure/inventory/durable-objects/inventory-reservation.ts";
import { D1InventoryLedger } from "#api/infrastructure/inventory/shared/d1-inventory-ledger.ts";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState) {}
  },
}));

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
const NOW = "2026-10-04T00:00:00.000Z";
const TENANT = "inventory-tenant";
const SKU = "inventory-sku";
const D1_BOUND_PARAMETER_LIMIT = 100;
const STORAGE_DELETE_KEY_LIMIT = 128;
const ORDER_IDS_PER_QUERY = 98;
// 98件のD1照合を3回、128件のDO削除を2回必要にする境界超過fixture。
const RESERVATION_LOAD = 197;
const INITIAL_STOCK = 1000;
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(
      new URL("../repositories/wrangler.inventory-test.jsonc", import.meta.url),
    ),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    for (const statement of readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8").split(
      file.startsWith("0014_") ? "--> statement-breakpoint" : ";",
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
  await platform.env.DB.prepare("DELETE FROM inventory_allocations").run();
  await platform.env.DB.prepare("DELETE FROM inventory_items").run();
});

// ローカルD1が本番のバインド上限を再現しない場合もあるため、境界で記録し上限超過を拒否する。
function observedDatabase(onBind?: (sql: string, values: unknown[]) => void) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const database = new Proxy(platform.env.DB, {
    get(target, property) {
      if (property === "prepare") {
        return (sql: string) => {
          const statement = target.prepare(sql);
          return new Proxy(statement, {
            get(target, property) {
              if (property === "bind") {
                return (...values: unknown[]) => {
                  queries.push({ sql, values });
                  if (values.length > D1_BOUND_PARAMETER_LIMIT) {
                    throw new Error("D1 bound parameter limit exceeded");
                  }

                  onBind?.(sql, values);
                  return target.bind(...values);
                };
              }

              const value = Reflect.get(target, property);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        };
      }

      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { database, queries };
}

function orderIds(count: number) {
  return Array.from({ length: count }, (_, index) => `order-${index}`);
}

async function allocations(ids: string[], tenantId = TENANT, sku = SKU) {
  if (ids.length === 0) {
    return;
  }

  await platform.env.DB.batch(
    ids.map((orderId) =>
      platform.env.DB.prepare(
        "INSERT INTO inventory_allocations (id, tenant_id, order_id, sku, quantity, committed_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(JSON.stringify([tenantId, orderId, sku]), tenantId, orderId, sku, 1, NOW),
    ),
  );
}

function inventory(database: D1Database, ids: string[], onDelete?: (keys: string[]) => void) {
  const deletions: string[][] = [];
  const values = new Map<string, unknown>([
    ["sku", SKU],
    ...ids.map((id): [string, number] => [`reservation:${id}`, 1]),
  ]);
  const ctx = {
    blockConcurrencyWhile: (callback: () => Promise<unknown>) => callback(),
    storage: {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: async (keys: string | string[]) => {
        if (Array.isArray(keys)) {
          if (keys.length > STORAGE_DELETE_KEY_LIMIT) {
            throw new Error("Durable Object delete key limit exceeded");
          }

          deletions.push([...keys]);
          onDelete?.(keys);
        }

        for (const key of typeof keys === "string" ? [keys] : keys) {
          values.delete(key);
        }
      },
      list: async (props: { prefix: string }) =>
        new Map([...values].filter((inputProps) => inputProps[0].startsWith(props.prefix))),
    },
  } as unknown as DurableObjectState;
  const instance = new InventoryReservation(ctx, { DB: database } as Env);
  return {
    values,
    deletions,
    request: (path: string, method = "GET", body?: object) =>
      instance.fetch(
        new Request(`https://inventory${path}`, {
          method,
          headers: { [INVENTORY_TENANT_HEADER]: TENANT },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      ),
  };
}

it("D1在庫台帳の確定済み予約照合 / 空の注文IDでは問い合わせない", async () => {
  const { database, queries } = observedDatabase();
  expect(await new D1InventoryLedger(database, TENANT).listCommittedOrderIds(SKU, [])).toEqual([]);
  expect(queries).toEqual([]);
});

it.each([1, 98, 99, 100, 196, 197, 1000])(
  "D1在庫台帳の確定済み予約照合 / %i件の注文IDを98件以下へ分割し、全チャンクの該当割当を返す",
  async (count) => {
    const ids = orderIds(count);
    const committed = ids.filter((_, index) => index % 2 === 0);
    await allocations(committed);
    const { database, queries } = observedDatabase();
    const result = await new D1InventoryLedger(database, TENANT).listCommittedOrderIds(SKU, ids);
    expect(result.sort()).toEqual(committed.sort());
    expect(queries).toHaveLength(Math.ceil(count / ORDER_IDS_PER_QUERY));
    expect(queries.flatMap((props) => props.values.slice(2))).toEqual(ids);
    for (const { values } of queries) {
      expect(values.slice(0, 2)).toEqual([TENANT, SKU]);
      expect(values.length).toBeLessThanOrEqual(D1_BOUND_PARAMETER_LIMIT);
    }
  },
);

it("D1在庫台帳の確定済み予約照合 / 入力とDB結果を重複排除し、別企業・別SKUの割当を混ぜない", async () => {
  const ids = orderIds(RESERVATION_LOAD);
  const committed = [ids[0], ids[98], ids[196]];
  await allocations(committed);
  await allocations(ids, "other-tenant");
  await allocations(ids, TENANT, "other-sku");
  await allocations(["unrequested"]);
  await platform.env.DB.prepare(
    "INSERT INTO inventory_allocations (id, tenant_id, order_id, sku, quantity, committed_at, restored_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind("duplicate-allocation", TENANT, ids[0], SKU, 1, NOW, NOW)
    .run();
  // 復元済み割当も冪等性の記録なので、残ったDO予約の照合対象から外してはいけない。
  await platform.env.DB.prepare(
    "UPDATE inventory_allocations SET restored_at = ? WHERE order_id = ?",
  )
    .bind(NOW, ids[196])
    .run();
  const repeated = [...ids, ...ids, ids[0]];
  const original = [...repeated];
  const { database, queries } = observedDatabase();
  const result = await new D1InventoryLedger(database, TENANT).listCommittedOrderIds(SKU, repeated);
  expect(result.sort()).toEqual(committed.sort());
  expect(queries).toHaveLength(3);
  expect(queries.flatMap((props) => props.values.slice(2))).toEqual(ids);
  expect(repeated).toEqual(original);
});

it("D1在庫台帳の確定済み予約照合 / 後続チャンクの障害を伝播し、不完全な照合結果を返さない", async () => {
  const ids = orderIds(RESERVATION_LOAD);
  await allocations(ids);
  let calls = 0;
  const { database, queries } = observedDatabase(() => {
    calls += 1;
    if (calls === 2) {
      throw new Error("later chunk failed");
    }
  });
  await expect(
    new D1InventoryLedger(database, TENANT).listCommittedOrderIds(SKU, ids),
  ).rejects.toThrow();
  expect(queries).toHaveLength(2);
});

it.each([128, 129, 197])(
  "多数の予約を保持する在庫DOとD1台帳 / %i件の確定済み予約を128件以下ずつ削除し、有効な予約は保持する",
  async (count) => {
    const ids = orderIds(count);
    await allocations(ids);
    const { database } = observedDatabase();
    await new D1InventoryLedger(database, TENANT).save({
      sku: SKU,
      onHand: INITIAL_STOCK,
      updatedAt: NOW,
    });
    const { request, values, deletions } = inventory(database, [...ids, "pending-order"]);
    const loaded = await request(`/?sku=${SKU}`);
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toMatchObject({
      stock: 1000,
      reserved: 1,
      available: 999,
      reservations: { "pending-order": 1 },
    });
    expect(deletions).toHaveLength(Math.ceil(count / STORAGE_DELETE_KEY_LIMIT));
    expect(deletions.every((keys) => keys.length <= STORAGE_DELETE_KEY_LIMIT)).toBe(true);
    expect(deletions.flat()).toEqual(ids.map((id) => `reservation:${id}`));
    for (const id of ids) {
      expect(values.has(`reservation:${id}`)).toBe(false);
    }

    expect(values.get("reservation:pending-order")).toBe(1);
    const reloaded = await request(`/?sku=${SKU}`);
    expect(reloaded.status).toBe(200);
    expect(await reloaded.json()).toMatchObject({ stock: 1000, reserved: 1, available: 999 });
    expect(deletions).toHaveLength(Math.ceil(count / STORAGE_DELETE_KEY_LIMIT));
  },
);

it("多数の予約を保持する在庫DOとD1台帳 / 削除の後続バッチが失敗しても予約操作を進めず、残存分の再照合後に再試行できる", async () => {
  const ids = orderIds(RESERVATION_LOAD);
  await allocations(ids);
  const { database } = observedDatabase();
  const ledger = new D1InventoryLedger(database, TENANT);
  await ledger.save({ sku: SKU, onHand: INITIAL_STOCK, updatedAt: NOW });
  let attempts = 0;
  const { request, values, deletions } = inventory(database, [...ids, "pending-order"], () => {
    attempts += 1;
    if (attempts === 2) {
      throw new Error("later deletion failed");
    }
  });
  const reserve = () =>
    request("/reservations", "POST", {
      orderId: "new-order",
      sku: SKU,
      quantity: 2,
    });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const failed = await reserve();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "在庫の処理に失敗しました" });
    expect(deletions.map((keys) => keys.length)).toEqual([128, 69]);
    expectPartialReservationDeletion(values, ids);
    expect(values.get("reservation:pending-order")).toBe(1);
    expect(values.has("reservation:new-order")).toBe(false);
    expect(await ledger.findBySku(SKU)).toMatchObject({ onHand: INITIAL_STOCK });

    const recovered = await reserve();
    expect(recovered.status).toBe(201);
    expect(await recovered.json()).toMatchObject({
      stock: 1000,
      reserved: 3,
      available: 997,
      reservations: { "pending-order": 1, "new-order": 2 },
    });
    expect(deletions.map((keys) => keys.length)).toEqual([128, 69, 69]);
    for (const id of ids) {
      expect(values.has(`reservation:${id}`)).toBe(false);
    }

    expect(values.get("reservation:new-order")).toBe(2);
    expect(await ledger.listCommittedOrderIds(SKU, ids)).toHaveLength(RESERVATION_LOAD);
    const repeated = await reserve();
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ stock: 1000, reserved: 3, available: 997 });
  } finally {
    log.mockRestore();
  }
});

it("多数の予約を保持する在庫DOとD1台帳 / 197件の予約を読み込み、残存した確定予約を除いて予約・解放・確定を継続する", async () => {
  const ids = orderIds(RESERVATION_LOAD);
  const stale = [ids[0], ids[98], ids[196]];
  const { database, queries } = observedDatabase();
  const ledger = new D1InventoryLedger(database, TENANT);
  await ledger.save({ sku: SKU, onHand: INITIAL_STOCK, updatedAt: NOW });
  await allocations(stale);
  const { request, values } = inventory(database, ids);
  const loaded = await request(`/?sku=${SKU}`);
  expect(loaded.status).toBe(200);
  expect(await loaded.json()).toMatchObject({ stock: 1000, reserved: 194, available: 806 });
  for (const id of stale) {
    expect(values.has(`reservation:${id}`)).toBe(false);
  }

  const reserved = await request("/reservations", "POST", {
    orderId: "new-order",
    sku: SKU,
    quantity: 2,
  });
  expect(reserved.status).toBe(201);
  expect(await reserved.json()).toMatchObject({ stock: 1000, reserved: 196, available: 804 });

  const released = await request(`/reservations/${ids[1]}?sku=${SKU}`, "DELETE");
  expect(released.status).toBe(200);
  expect(await released.json()).toMatchObject({ stock: 1000, reserved: 195, available: 805 });
  expect(values.has(`reservation:${ids[1]}`)).toBe(false);

  const commitPath = `/reservations/new-order/commit?sku=${SKU}`;
  const committed = await request(commitPath, "POST");
  expect(committed.status).toBe(200);
  expect(await committed.json()).toMatchObject({ stock: 998, reserved: 193, available: 805 });
  expect(values.has("reservation:new-order")).toBe(false);
  expect(await ledger.findAllocation({ orderId: "new-order", sku: SKU })).toMatchObject({
    status: "committed",
    quantity: 2,
  });
  const retried = await request(commitPath, "POST");
  expect(retried.status).toBe(200);
  expect(await retried.json()).toMatchObject({ stock: 998, reserved: 193, available: 805 });
  expect(queries.every((props) => props.values.length <= D1_BOUND_PARAMETER_LIMIT)).toBe(true);
});

it("多数の予約を保持する在庫DOとD1台帳 / チャンク途中の障害ではDO予約を消さず、復旧後に照合をやり直せる", async () => {
  const ids = orderIds(RESERVATION_LOAD);
  await allocations(ids);
  let lookups = 0;
  let fail = true;
  const { database } = observedDatabase((sql) => {
    if (!sql.includes('select "order_id"')) {
      return;
    }

    lookups += 1;
    if (fail && lookups === 2) {
      throw new Error("later chunk failed");
    }
  });
  await new D1InventoryLedger(database, TENANT).save({
    sku: SKU,
    onHand: INITIAL_STOCK,
    updatedAt: NOW,
  });
  const { request, values } = inventory(database, ids);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const failed = await request(`/?sku=${SKU}`);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "在庫の処理に失敗しました" });
    for (const id of ids) {
      expect(values.has(`reservation:${id}`)).toBe(true);
    }

    fail = false;
    const recovered = await request(`/?sku=${SKU}`);
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ stock: 1000, reserved: 0, available: 1000 });
    for (const id of ids) {
      expect(values.has(`reservation:${id}`)).toBe(false);
    }
  } finally {
    log.mockRestore();
  }
});

function expectPartialReservationDeletion(values: Map<string, unknown>, ids: string[]) {
  for (const id of ids.slice(0, STORAGE_DELETE_KEY_LIMIT)) {
    expect(values.has(`reservation:${id}`)).toBe(false);
  }

  for (const id of ids.slice(STORAGE_DELETE_KEY_LIMIT)) {
    expect(values.get(`reservation:${id}`)).toBe(1);
  }
}
