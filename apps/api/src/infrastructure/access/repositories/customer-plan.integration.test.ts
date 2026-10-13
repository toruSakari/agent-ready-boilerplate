// @vitest-environment node
import { expect, it, vi } from "vite-plus/test";
import {
  access,
  admin,
  business,
  customer,
  query,
  repository,
  PLAN,
  setPlan,
} from "#api/infrastructure/access/repositories/plan-permissions.integration.test-fixture.ts";

it("本人の変更 / 未設定から選択・解除・再選択でき、企業や他のユーザーへ影響しない", async () => {
  await setPlan("customer", customer.userId, null);
  expect((await access.customerPlans(customer)).currentCode).toBeNull();
  const company = await query.plan({ category: "business", id: "demo-store" });
  const other = await query.plan({ category: "customer", id: "customer:demo-customer" });
  await access.changeCustomerPlan(customer, { planCode: PLAN.customerRead });
  expect((await access.customerPlans(customer)).currentCode).toBe(PLAN.customerRead);
  await access.changeCustomerPlan(customer, { planCode: null });
  expect((await access.customerPlans(customer)).currentCode).toBeNull();
  await access.changeCustomerPlan(customer, { planCode: PLAN.customerFull });
  expect((await access.customerPlans(customer)).currentCode).toBe(PLAN.customerFull);
  expect(await query.plan({ category: "business", id: "demo-store" })).toEqual(company);
  expect(await query.plan({ category: "customer", id: "customer:demo-customer" })).toEqual(other);
  expect(await query.audit("customer")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "plan.change",
        actorId: customer.userId,
        targetId: customer.userId,
      }),
    ]),
  );
});
it.each(["unknown", PLAN.businessFull])("本人の変更 / %sは保存も監査もしない", async (planCode) => {
  await expect(access.changeCustomerPlan(customer, { planCode })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect((await repository.load("platform")).version).toBe(0);
  expect(await query.audit("customer")).toEqual([]);
});
it.each([admin, business])("本人の変更 / $channel会員は個人プランを変更できない", async (actor) => {
  await expect(
    access.changeCustomerPlan(actor, { planCode: PLAN.customerFull }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await repository.load("platform")).version).toBe(0);
});
it("本人の変更 / 運営も一般ユーザーのプランを割り当てられない", async () => {
  await expect(
    access.assignPlan(admin, {
      category: "customer",
      id: customer.userId,
      planCode: PLAN.customerFull,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("本人の変更 / 保存競合でプランと監査を上書きしない", async () => {
  vi.spyOn(repository, "commit").mockResolvedValueOnce(false);
  const previous = await access.customerPlans(customer);
  await expect(
    access.changeCustomerPlan(customer, { planCode: PLAN.customerRead }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await access.customerPlans(customer)).toEqual(previous);
  expect(await query.audit("customer")).toEqual([]);
});
