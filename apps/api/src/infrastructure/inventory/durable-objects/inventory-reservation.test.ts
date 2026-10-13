import { restoreStoredReservation } from "#api/infrastructure/inventory/mappers/restore-stored-reservation.ts";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { InventoryReservation } from "#api/infrastructure/inventory/durable-objects/inventory-reservation.ts";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  findBySku: vi.fn(),
  findAllocation: vi.fn(),
  restoreAllocation: vi.fn(),
  isAllocationCommitted: vi.fn(),
  commitAllocation: vi.fn(),
}));
vi.mock("cloudflare:workers", async () => {
  const { DurableObjectFixture } =
    await import("#api/infrastructure/inventory/durable-objects/durable-object.test-fixture.ts");
  return { DurableObject: DurableObjectFixture };
});
vi.mock("#api/infrastructure/inventory/shared/d1-inventory-ledger.ts", () => ({
  D1InventoryLedger: class {
    save = mocks.save;
    findBySku = mocks.findBySku;
    findAllocation = mocks.findAllocation;
    restoreAllocation = mocks.restoreAllocation;
    isAllocationCommitted = mocks.isAllocationCommitted;
    commitAllocation = mocks.commitAllocation;
    listCommittedOrderIds = vi.fn().mockResolvedValue([]);
  },
}));

function inventory(boundTenant?: string, reservations = new Map<string, number>()) {
  const ctx = {
    blockConcurrencyWhile: (callback: () => Promise<unknown>) => callback(),
    storage: {
      get: vi
        .fn()
        .mockImplementation(async (key: string) => (key === "tenantId" ? boundTenant : undefined)),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue(reservations),
    },
  } as unknown as DurableObjectState;
  return new InventoryReservation(ctx, {} as Env);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findBySku.mockResolvedValue({ sku: "s1", onHand: 1 });
  mocks.findAllocation.mockResolvedValue(null);
});

it.each(["{", "null", JSON.stringify({ sku: "s1", orderId: "o1", quantity: -1 })])(
  "在庫DOのHTTPエラー応答 / 不正な予約リクエストを400で拒否する: %s",
  async (body) => {
    const response = await inventory().fetch(
      new Request("https://inventory/reservations", {
        method: "POST",
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "リクエストの形式が不正です" });
    expect(mocks.findBySku).not.toHaveBeenCalled();
  },
);

it("在庫DOのHTTPエラー応答 / 在庫不足は409になる", async () => {
  const response = await inventory().fetch(
    new Request("https://inventory/reservations", {
      method: "POST",
      body: JSON.stringify({ sku: "s1", orderId: "o1", quantity: 2 }),
    }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "在庫が不足しています" });
});

it("在庫DOのHTTPエラー応答 / 存在しない在庫は404になる", async () => {
  mocks.findBySku.mockResolvedValue(null);
  const response = await inventory().fetch(new Request("https://inventory/?sku=missing"));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "対象の在庫が見つかりません" });
});

it("在庫DOのHTTPエラー応答 / GETのDB障害も500に変換し、内部情報を公開しない", async () => {
  mocks.findBySku.mockRejectedValue(new Error("秘密 token=private"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await inventory().fetch(new Request("https://inventory/?sku=s1"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "在庫の処理に失敗しました" });
  } finally {
    log.mockRestore();
  }
});

function statefulInventory() {
  const values = new Map<string, unknown>([
    ["sku", "s1"],
    ["reservation:r1", 1],
  ]);
  const ctx = {
    blockConcurrencyWhile: (callback: () => Promise<unknown>) => callback(),
    storage: {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: async (keys: string | string[]) => {
        for (const key of typeof keys === "string" ? [keys] : keys) {
          values.delete(key);
        }
      },
      list: async () => new Map([...values].filter((props) => props[0].startsWith("reservation:"))),
    },
  } as unknown as DurableObjectState;
  return { values, instance: new InventoryReservation(ctx, {} as Env) };
}

it("在庫取消の再配信と遅延確定 / 取消後に確定が届いても在庫を減らさない", async () => {
  const { instance, values } = statefulInventory();
  mocks.restoreAllocation.mockResolvedValue(undefined);
  const response = await instance.fetch(
    new Request("https://inventory/allocations/r1/cancel?sku=s1", { method: "POST" }),
  );
  expect(response.status).toBe(200);
  expect(values.get("cancelled:r1")).toBe(true);
  expect(values.has("reservation:r1")).toBe(false);
  const committed = await instance.fetch(
    new Request("https://inventory/reservations/r1/commit?sku=s1", { method: "POST" }),
  );
  expect(committed.status).toBe(200);
  expect(mocks.commitAllocation).not.toHaveBeenCalled();
});

it("在庫取消の再配信と遅延確定 / DBの復元失敗後も取消印を保持し、次の配信で復元を再試行する", async () => {
  const { instance, values } = statefulInventory();
  mocks.findAllocation.mockResolvedValue(
    restoreStoredReservation({
      orderId: "r1",
      sku: "s1",
      quantity: 1,
      status: "committed",
    }),
  );
  mocks.restoreAllocation
    .mockRejectedValueOnce(new Error("DB障害"))
    .mockResolvedValueOnce(undefined);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const request = () =>
      new Request("https://inventory/allocations/r1/cancel?sku=s1", { method: "POST" });
    expect((await instance.fetch(request())).status).toBe(500);
    expect(values.get("cancelled:r1")).toBe(true);
    expect((await instance.fetch(request())).status).toBe(200);
    expect(mocks.restoreAllocation).toHaveBeenCalledTimes(2);
  } finally {
    log.mockRestore();
  }
});

it("解放済みIDへの再予約を409で拒否し、遅れた確定も実行しない", async () => {
  const values = new Map<string, unknown>([
    ["sku", "s1"],
    ["released:r1", true],
  ]);
  const ctx = {
    blockConcurrencyWhile: (callback: () => Promise<unknown>) => callback(),
    storage: {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue(new Map()),
    },
  } as unknown as DurableObjectState;
  const instance = new InventoryReservation(ctx, {} as Env);
  const response = await instance.fetch(
    new Request("https://inventory/reservations", {
      method: "POST",
      body: JSON.stringify({ sku: "s1", orderId: "r1", quantity: 1 }),
    }),
  );
  expect(response.status).toBe(409);
  expect(
    (
      await instance.fetch(
        new Request("https://inventory/reservations/r1/commit?sku=s1", { method: "POST" }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.commitAllocation).not.toHaveBeenCalled();
});

it("別企業のヘッダーで同じDOの在庫へアクセスできない", async () => {
  const instance = inventory("company-a");
  const response = await instance.fetch(
    new Request("https://inventory/stock?sku=s1", {
      headers: { "x-inventory-tenant": "company-b" },
    }),
  );
  expect(response.status).toBe(409);
  expect(mocks.findBySku).not.toHaveBeenCalled();
});

it("在庫変更は古い期待在庫を拒否して保存しない", async () => {
  const response = await inventory().fetch(
    new Request("https://inventory/stock", {
      method: "POST",
      body: JSON.stringify({ sku: "s1", quantity: 5, expectedStock: 0 }),
    }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ reason: "STOCK_CHANGED" });
  expect(mocks.save).not.toHaveBeenCalled();
});
it("在庫未登録の商品を0から補充できる", async () => {
  mocks.findBySku.mockResolvedValue(null);
  const response = await inventory().fetch(
    new Request("https://inventory/stock", {
      method: "POST",
      body: JSON.stringify({ sku: "s1", quantity: 5, expectedStock: 0 }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ stock: 5, reserved: 0, available: 5 });
  expect(mocks.save).toHaveBeenCalled();
});

it("注文予約を下回る在庫への変更を拒否する", async () => {
  mocks.findBySku.mockResolvedValue({ sku: "s1", onHand: 5 });
  const response = await inventory(undefined, new Map([["reservation:order-1", 3]])).fetch(
    new Request("https://inventory/stock", {
      method: "POST",
      body: JSON.stringify({ sku: "s1", quantity: 2, expectedStock: 5 }),
    }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ reason: "STOCK_RESERVED" });
  expect(mocks.save).not.toHaveBeenCalled();
});

it("内部スナップショットは現在庫・予約を欠落させずRepositoryの復元へ渡す", async () => {
  mocks.findBySku.mockResolvedValue({ sku: "s1", onHand: 5 });
  const response = await inventory(undefined, new Map([["reservation:private-order", 2]])).fetch(
    new Request("https://inventory/snapshot?sku=s1"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    sku: "s1",
    onHand: 5,
    reservations: [{ orderId: "private-order", quantity: 2 }],
  });
});
