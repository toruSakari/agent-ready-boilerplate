import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createAccessTestHarness } from "#admin/test/access-harness.tsx";
import { useOrganizations, useUsers } from "#admin/entities/directory/api/use-directory.ts";

const organizations = [
  { id: "organization-a", name: "企業A", active: true, invitationsEnabled: true, memberCount: 1 },
];
const users = [
  { id: "operator-a", category: "operator", name: "管理者", email: null, memberships: [] },
];
afterEach(cleanup);

describe("運営向けの企業・ユーザー一覧取得", () => {
  it("クライアント側で権限による事前絞り込みをせず両方の一覧を要求する", async () => {
    // 権限Providerを与えず、一覧hookが古いクライアント権限を前提に取得を抑止しないことを確認する。
    const harness = createAccessTestHarness({
      "access.organizations": { data: organizations },
      "access.users": { data: users },
    });
    const { result } = renderHook(
      () => ({ organizations: useOrganizations(), users: useUsers() }),
      { wrapper: harness.Providers },
    );
    await waitFor(() => {
      expect(result.current.organizations.data).toEqual(organizations);
      expect(result.current.users.data).toEqual(users);
    });
    expect(harness.requests).toEqual([
      { path: "access.organizations", input: undefined },
      { path: "access.users", input: undefined },
    ]);
  });
});
