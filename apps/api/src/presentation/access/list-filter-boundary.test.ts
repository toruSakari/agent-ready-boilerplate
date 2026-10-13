import { expect, it } from "vite-plus/test";
import { mocks, query } from "#api/presentation/api-app.test-fixture.ts";
import { PLATFORM_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";

it("企業一覧検索には運営の企業閲覧権限を要求する", async () => {
  mocks.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: PLATFORM_PERMISSIONS.filter((p) => p !== "organization.read"),
  });
  const response = await query("access.organizationDirectory", { status: "active" });
  expect(response.status).toBe(403);
  expect(mocks.organizationDirectory).not.toHaveBeenCalled();
});
it("一覧検索条件を認可済み運営会員とUseCaseへ渡す", async () => {
  mocks.organizationDirectory.mockResolvedValue({ items: [], nextId: null });
  const response = await query("access.organizationDirectory", {
    search: "企業",
    status: "active",
  });
  expect(response.status).toBe(200);
  expect(mocks.organizationDirectory).toHaveBeenCalledWith({
    actor: expect.objectContaining({ channel: "admin", service: "operator" }),
    filters: { search: "企業", status: "active" },
    page: { limit: 25 },
  });
});
it("不正な状態をサーバー側で拒否する", async () => {
  const response = await query("access.organizationDirectory", { status: "confirmed" });
  expect(response.status).toBe(400);
  expect(mocks.organizationDirectory).not.toHaveBeenCalled();
});
