import { beforeEach, expect, it, vi } from "vite-plus/test";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import { D1DoInventoryRepository } from "#api/infrastructure/inventory/repositories/d1-do-inventory-repository.ts";

const ledger = vi.hoisted(() => ({
  findBySku: vi.fn(),
  listCommittedOrderIds: vi.fn(),
  commitAllocation: vi.fn(),
  save: vi.fn(),
}));
vi.mock("#api/infrastructure/inventory/shared/d1-inventory-ledger.ts", () => ({
  D1InventoryLedger: class {
    findBySku = ledger.findBySku;
    listCommittedOrderIds = ledger.listCommittedOrderIds;
    commitAllocation = ledger.commitAllocation;
    save = ledger.save;
  },
}));
const NOW = "2026-10-11T00:00:00.000Z";

function fixture() {
  const values = new Map<string, unknown>([["reservation:order-1", 1]]);
  const storage = {
    get: vi.fn(async (key: string) => values.get(key)),
    put: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    list: vi.fn(async () => new Map(values)),
    delete: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        values.delete(key);
      }
    }),
  };
  const repository = new D1DoInventoryRepository(
    {} as D1Database,
    storage as unknown as DurableObjectStorage,
    "tenant",
    "legacy",
  );
  return { repository, storage, values };
}

beforeEach(() => {
  vi.resetAllMocks();
  ledger.findBySku.mockResolvedValue({ sku: "s1", onHand: 3, updatedAt: NOW });
  ledger.listCommittedOrderIds.mockResolvedValue([]);
});

it("D1台帳とDO予約を検証・復元し、操作できるEntityを返す", async () => {
  const { repository } = fixture();
  const item = await repository.find("s1");
  expect(item).toBeInstanceOf(InventoryItem);
  expect(item?.available).toBe(2);
  expect(item?.findReservation("order-1")?.status).toBe("reserved");
  expect(item?.events).toEqual([]);
});
it("未検出はnullとし、初期化でも残存予約が0在庫を超える状態は拒否する", async () => {
  ledger.findBySku.mockResolvedValue(null);
  const { repository, values } = fixture();
  expect(await repository.find("s1")).toBeNull();
  await expect(repository.find("s1", true)).rejects.toThrow("在庫台帳の復元に失敗しました");
  values.clear();
  expect(await repository.find("s1", true)).toBeInstanceOf(InventoryItem);
});
it("不正なD1数量はEntityとして返さず、DO予約を保持する", async () => {
  ledger.findBySku.mockResolvedValue({ sku: "s1", onHand: -1 });
  const { repository, values } = fixture();
  await expect(repository.find("s1")).rejects.toThrow("在庫台帳の復元に失敗しました");
  expect(values.get("reservation:order-1")).toBe(1);
});
it("D1確定失敗ではDO予約を削除しない", async () => {
  const { repository, values } = fixture();
  const current = (await repository.find("s1"))!;
  const changed = current.commitReservation({
    reservation: current.findReservation("order-1")!,
    now: NOW,
    eventId: "event-1",
  });
  ledger.commitAllocation.mockRejectedValue(new Error("D1 failure"));
  await expect(repository.save(changed)).rejects.toThrow("D1 failure");
  expect(values.get("reservation:order-1")).toBe(1);
});
it("D1成功後のDO削除失敗は次の取得で照合し、在庫を二重に減らさない", async () => {
  const { repository, storage, values } = fixture();
  const current = (await repository.find("s1"))!;
  const changed = current.commitReservation({
    reservation: current.findReservation("order-1")!,
    now: NOW,
    eventId: "event-1",
  });
  storage.delete.mockRejectedValueOnce(new Error("DO failure"));
  await expect(repository.save(changed)).rejects.toThrow("DO failure");
  ledger.findBySku.mockResolvedValue({ sku: "s1", onHand: 2, updatedAt: NOW });
  ledger.listCommittedOrderIds.mockResolvedValue(["order-1"]);
  const restored = await repository.find("s1");
  expect(restored?.onHand).toBe(2);
  expect(restored?.reserved).toBe(0);
  expect(values.has("reservation:order-1")).toBe(false);
  expect(ledger.commitAllocation).toHaveBeenCalledTimes(1);
});
it("復元しただけのEntityの保存を拒否し、変更イベントなしで台帳を上書きしない", async () => {
  const { repository } = fixture();
  const current = (await repository.find("s1"))!;
  await expect(repository.save(current)).rejects.toThrow("今回の変更を持つ在庫を指定してください");
  expect(ledger.save).not.toHaveBeenCalled();
});
