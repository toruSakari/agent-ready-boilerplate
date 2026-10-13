import { describe, expect, it, vi } from "vite-plus/test";
import { InventoryDurableObjectGateway } from "#api/infrastructure/order/gateways/inventory-do-gateway.ts";

function gateway(response: Response) {
  return new InventoryDurableObjectGateway({
    idFromName: vi.fn(),
    get: () => ({ fetch: vi.fn().mockResolvedValue(response) }),
  });
}

describe("在庫APIのエラー変換", () => {
  it.each([
    [400, "BAD_REQUEST"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [500, "INTERNAL_SERVER_ERROR"],
  ] as const)("上流HTTP %sを%sへ変換する", async (status, code) => {
    const inventory = gateway(new Response("内部情報 token=private", { status }));
    await expect(
      inventory.reserve({ tenantId: "demo-store", orderId: "o1", sku: "s1", quantity: 1 }),
    ).rejects.toMatchObject({ code });
  });

  it("上流の本文がJSONでなくても内部情報を転送しない", async () => {
    const inventory = gateway(new Response("<html>token=private</html>", { status: 502 }));
    await expect(
      inventory.reserve({ tenantId: "demo-store", orderId: "o1", sku: "s1", quantity: 1 }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "在庫を予約できませんでした",
    });
  });
});

it("旧SKUと複合キーが同じ文字列でも企業のDO名前空間を分離する", async () => {
  const oldFetch = vi.fn().mockResolvedValue(new Response("{}"));
  const tenantFetch = vi.fn().mockResolvedValue(new Response("{}"));
  const old = { idFromName: vi.fn(), get: () => ({ fetch: oldFetch }) };
  const scoped = { idFromName: vi.fn(), get: () => ({ fetch: tenantFetch }) };
  const inventory = new InventoryDurableObjectGateway(old, scoped);
  // 名前が偶然一致するSKUを使い、キー形式だけでなく別DO名前空間の選択まで検証する。
  await inventory.reserve({
    tenantId: "demo-store",
    sku: '["company-b","s1"]',
    orderId: "legacy",
    quantity: 1,
  });
  await inventory.reserve({ tenantId: "company-b", sku: "s1", orderId: "new", quantity: 1 });
  expect(old.idFromName).toHaveBeenCalledWith('["company-b","s1"]');
  expect(scoped.idFromName).toHaveBeenCalledWith('["company-b","s1"]');
  expect(oldFetch).toHaveBeenCalledTimes(1);
  expect(tenantFetch).toHaveBeenCalledTimes(1);
  expect(tenantFetch.mock.calls[0]?.[1].headers["x-inventory-tenant"]).toBe("company-b");
});

it("企業向け在庫応答に注文IDの予約一覧を含めない", async () => {
  const result = await gateway(
    Response.json({ stock: 5, reserved: 2, available: 3, reservations: { "private-order": 2 } }),
  ).changeStock({ tenantId: "demo-store", sku: "s1", quantity: 5, expectedStock: 0 });
  expect(result).toEqual({ onHand: 5, reserved: 2, available: 3 });
});
it.each(["STOCK_CHANGED", "STOCK_RESERVED"])("在庫競合の公開理由%sを保持する", async (reason) => {
  await expect(
    gateway(Response.json({ reason }, { status: 409 })).changeStock({
      tenantId: "demo-store",
      sku: "s1",
      quantity: 5,
      expectedStock: 0,
    }),
  ).rejects.toMatchObject({ code: "CONFLICT", reason });
});
