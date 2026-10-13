import { expect, it } from "vite-plus/test";
import { mocks, query } from "#api/presentation/api-app.test-fixture.ts";
import { PLATFORM_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";

it.each(["organization.read", "plan.manage"] as const)(
  "企業プラン照会 / %sがなければ処理を呼ばない",
  async (missing) => {
    mocks.grant.mockResolvedValue({
      active: true,
      protectedRole: false,
      permissions: PLATFORM_PERMISSIONS.filter((permission) => permission !== missing),
    });
    const response = await query("access.organizationPlan", { id: "org-1" });
    expect(response.status).toBe(403);
    expect(mocks.organizationPlan).not.toHaveBeenCalled();
  },
);
it("企業プラン照会 / 運営会員で対象企業を照会する", async () => {
  mocks.organizationPlan.mockResolvedValue({ code: "standard" });
  const response = await query("access.organizationPlan", { id: "org-1" });
  expect(response.status).toBe(200);
  expect(mocks.organizationPlan).toHaveBeenCalledWith({
    identity: expect.objectContaining({ userId: "operator:user-1" }),
    id: "org-1",
  });
  expect(await response.json()).toMatchObject({ result: { data: { code: "standard" } } });
});
