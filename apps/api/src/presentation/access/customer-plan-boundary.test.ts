import { expect, it } from "vite-plus/test";
import { mocks, query, request } from "#api/presentation/api-app.test-fixture.ts";

it("個人プラン / プラン未設定でも本人のカタログ照会と変更を許可する", async () => {
  mocks.grant.mockResolvedValue({ active: true, protectedRole: false, permissions: [] });
  mocks.customerPlans.mockResolvedValue({ currentCode: null, plans: [] });
  expect((await query("access.customerPlans", {})).status).toBe(200);
  expect(
    (await request("/api/trpc/access.changeCustomerPlan", { planCode: "customer:demo" })).status,
  ).toBe(200);
  expect(mocks.changeCustomerPlan).toHaveBeenCalledWith({
    identity: expect.objectContaining({
      userId: "customer:user-1",
      platform: false,
      accessSnapshot: expect.objectContaining({ scope: "customer:user-1" }),
    }),
    input: { planCode: "customer:demo" },
  });
});
it.each([
  { id: "customer:other", planCode: "customer:demo" },
  { category: "business", planCode: "customer:demo" },
  { service: "operator", planCode: "customer:demo" },
  { planCode: "customer:demo", permissions: ["plan.manage"] },
])("個人プラン / 変更対象・会員種別・権限の入力を拒否する %j", async (input) => {
  expect((await request("/api/trpc/access.changeCustomerPlan", input)).status).toBe(400);
  expect(mocks.changeCustomerPlan).not.toHaveBeenCalled();
});
it("個人プラン / 未登録の本人を拒否する", async () => {
  mocks.resolveAccount.mockResolvedValue(null);
  mocks.isRegistered.mockResolvedValue(false);
  expect((await request("/api/trpc/access.changeCustomerPlan", { planCode: null })).status).toBe(
    403,
  );
  expect(mocks.changeCustomerPlan).not.toHaveBeenCalled();
});
it("個人プラン / 運営の旧割当APIは一般ユーザーへの変更を拒否する", async () => {
  const response = await request("/api/trpc/access.assignPlan", {
    category: "customer",
    id: "customer:user-1",
    planCode: null,
  });
  expect(response.status).toBe(400);
  expect(mocks.assignPlan).not.toHaveBeenCalled();
});
