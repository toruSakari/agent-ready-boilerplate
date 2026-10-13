// @vitest-environment node
import { expect, it } from "vite-plus/test";
import {
  access,
  admin,
  PLAN,
} from "#api/infrastructure/access/repositories/plan-permissions.integration.test-fixture.ts";

it("企業詳細のプラン照会は変更・解除を反映し、別企業へ影響しない", async () => {
  const other = await access.organizationPlan(admin, "demo-second");
  await access.assignPlan(admin, {
    category: "business",
    id: "demo-store",
    planCode: PLAN.businessRead,
  });
  expect(await access.organizationPlan(admin, "demo-store")).toEqual({ code: PLAN.businessRead });
  await access.assignPlan(admin, { category: "business", id: "demo-store", planCode: null });
  expect(await access.organizationPlan(admin, "demo-store")).toEqual({ code: null });
  expect(await access.organizationPlan(admin, "demo-second")).toEqual(other);
});
it("存在しない企業のプランを返さない", async () => {
  await expect(access.organizationPlan(admin, "missing-company")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
