import { expect, it, vi } from "vite-plus/test";
import { DurableInventoryReadRepository } from "#api/infrastructure/inventory/repositories/durable-inventory-read-repository.ts";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";

function fixture(snapshot?: unknown) {
  const fetch = vi.fn(async (url: RequestInfo | URL) =>
    Response.json(
      snapshot ?? {
        sku: new URL(url instanceof Request ? url.url : url).searchParams.get("sku"),
        onHand: 5,
        reservations: [{ orderId: "private-order", quantity: 2 }],
      },
    ),
  );
  const legacy = { idFromName: vi.fn(), get: () => ({ fetch }) };
  const scoped = { idFromName: vi.fn(), get: () => ({ fetch }) };
  return { fetch, legacy, scoped, repository: new DurableInventoryReadRepository(legacy, scoped) };
}

it("DOの完全な在庫状態をEntityへ復元し、企業・SKUの経路と重複排除を維持する", async () => {
  const { repository, fetch, legacy, scoped } = fixture();
  const items = await repository.findMany("company-a", ["s1", "s1", "s2"]);
  expect(items).toHaveLength(2);
  expect(items[0]).toBeInstanceOf(InventoryItem);
  expect(items[0]?.toSnapshot()).toEqual({
    sku: "s1",
    onHand: 5,
    reservations: [{ orderId: "private-order", quantity: 2 }],
  });
  expect(items[0]?.available).toBe(3);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith("https://inventory/snapshot?sku=s1&allowMissing=true", {
    headers: { "x-inventory-tenant": "company-a" },
  });
  expect(legacy.idFromName).not.toHaveBeenCalled();
  expect(scoped.idFromName.mock.calls).toEqual([
    [JSON.stringify(["company-a", "s1"])],
    [JSON.stringify(["company-a", "s2"])],
  ]);
  expect(fetch.mock.calls[0]?.[0]).toBe("https://inventory/snapshot?sku=s1&allowMissing=true");
});
it.each([
  { sku: "s1", onHand: 1, reservations: [{ orderId: "order", quantity: 2 }] },
  { sku: "wrong-sku", onHand: 5, reservations: [] },
])("DOの不整合な予約・別SKUをUseCaseへ返さない: $sku", async (snapshot) => {
  const { repository } = fixture(snapshot);
  await expect(repository.find("company-a", "s1")).rejects.toThrow();
});
it("空の一覧はDOへ問い合わせない", async () => {
  const { repository, fetch } = fixture();
  expect(await repository.findMany("company-a", [])).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
