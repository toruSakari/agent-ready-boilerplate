import { expect, it } from "vite-plus/test";
import { mocks, request, query } from "#api/presentation/api-app.test-fixture.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

const headers = { "x-organization-id": "org-1" };
const input = { id: "product-1", quantity: 5, expectedStock: 3 };
it("在庫操作には企業の認可済みActorを渡し、IP制限も適用する", async () => {
  const response = await request("/api/trpc/inventory.change", input, "http://localhost", headers);
  expect(response.status).toBe(200);
  expect(mocks.assertBusinessIp).toHaveBeenCalledOnce();
  expect(mocks.changeStock).toHaveBeenCalledExactlyOnceWith({
    actor: expect.objectContaining({ tenantId: "org-1", channel: "business" }),
    input: input,
  });
});
it("在庫閲覧は商品更新権限のない企業会員にも許可する", async () => {
  mocks.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: ["product.read"],
  });
  expect((await query("inventory.get", { id: input.id }, "http://localhost", headers)).status).toBe(
    200,
  );
  expect(
    (await request("/api/trpc/inventory.change", input, "http://localhost", headers)).status,
  ).toBe(403);
  expect(mocks.changeStock).not.toHaveBeenCalled();
});
it("企業IP制限で拒否した場合は在庫を変更しない", async () => {
  mocks.assertBusinessIp.mockRejectedValue(
    new ApplicationError({ code: "FORBIDDEN", message: "拒否" }),
  );
  expect(
    (await request("/api/trpc/inventory.change", input, "http://localhost", headers)).status,
  ).toBe(403);
  expect(mocks.changeStock).not.toHaveBeenCalled();
});
it.each([
  { ...input, tenantId: "other" },
  { id: input.id, quantity: 5 },
  { ...input, expectedStock: -1 },
])("企業指定・期待在庫の欠落や不正値を拒否する", async (data) => {
  expect(
    (await request("/api/trpc/inventory.change", data, "http://localhost", headers)).status,
  ).toBe(400);
  expect(mocks.changeStock).not.toHaveBeenCalled();
});
const adjustmentInput = {
  id: input.id,
  operationId: crypto.randomUUID(),
  adjustment: { operation: "receive", quantity: 10, reason: "delivery" },
};
it("入荷・在庫一覧・履歴も認可済み企業とIP制限を使う", async () => {
  expect(
    (await request("/api/trpc/inventory.adjust", adjustmentInput, "http://localhost", headers))
      .status,
  ).toBe(200);
  expect(mocks.adjustStock).toHaveBeenCalledWith({
    actor: expect.objectContaining({ tenantId: "org-1", channel: "business" }),
    input: adjustmentInput,
  });
  expect((await query("inventory.list", { limit: 25 }, "http://localhost", headers)).status).toBe(
    200,
  );
  expect(
    (await query("inventory.history", { id: input.id }, "http://localhost", headers)).status,
  ).toBe(200);
  expect(mocks.assertBusinessIp).toHaveBeenCalledTimes(3);
});
it("入荷・棚卸しには更新権限を要求し、閲覧権限だけでは変更させない", async () => {
  mocks.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: ["product.read"],
  });
  expect(
    (await request("/api/trpc/inventory.adjust", adjustmentInput, "http://localhost", headers))
      .status,
  ).toBe(403);
  expect(mocks.adjustStock).not.toHaveBeenCalled();
  expect((await query("inventory.list", {}, "http://localhost", headers)).status).toBe(200);
  expect(
    (await query("inventory.history", { id: input.id }, "http://localhost", headers)).status,
  ).toBe(200);
});
it.each([
  { ...adjustmentInput, actorId: "other" },
  { ...adjustmentInput, tenantId: "other" },
  { ...adjustmentInput, adjustment: { operation: "receive", quantity: 0, reason: "delivery" } },
  { ...adjustmentInput, adjustment: { operation: "receive", quantity: 3, reason: "damage" } },
  { ...adjustmentInput, adjustment: { operation: "recount", quantity: 3, reason: "stocktake" } },
])("実行者・企業の偽装と不正な在庫操作を拒否する", async (data) => {
  expect(
    (await request("/api/trpc/inventory.adjust", data, "http://localhost", headers)).status,
  ).toBe(400);
  expect(mocks.adjustStock).not.toHaveBeenCalled();
});
it("IP制限で拒否された在庫照会・入荷を実行しない", async () => {
  mocks.assertBusinessIp.mockRejectedValue(
    new ApplicationError({ code: "FORBIDDEN", message: "拒否" }),
  );
  expect(
    (await request("/api/trpc/inventory.adjust", adjustmentInput, "http://localhost", headers))
      .status,
  ).toBe(403);
  expect((await query("inventory.list", {}, "http://localhost", headers)).status).toBe(403);
  expect(
    (await query("inventory.history", { id: input.id }, "http://localhost", headers)).status,
  ).toBe(403);
  expect(mocks.adjustStock).not.toHaveBeenCalled();
  expect(mocks.inventoryList).not.toHaveBeenCalled();
  expect(mocks.stockHistory).not.toHaveBeenCalled();
});
