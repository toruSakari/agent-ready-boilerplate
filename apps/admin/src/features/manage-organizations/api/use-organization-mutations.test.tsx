import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useTRPC } from "@dev-template/client/api";
import { createAccessTestHarness } from "#admin/test/access-harness.tsx";
import { useOrganizationMutations } from "#admin/features/manage-organizations/api/use-organization-mutations.ts";

const organization = {
  id: "organization-a",
  name: "企業A",
  active: true,
  invitationsEnabled: false,
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 成功時だけ関連accessキャッシュを更新し、拒否時に成功したような再取得を発生させない契約を確認する。
describe("運営による企業情報の更新処理", () => {
  it("企業の作成・更新後にすべてのアクセス関連データのキャッシュを無効化する", async () => {
    const harness = createAccessTestHarness({
      "access.createOrganization": { data: organization },
      "access.updateOrganization": { data: undefined },
    });
    const invalidate = vi.spyOn(harness.queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => ({ mutations: useOrganizationMutations(), filter: useTRPC().access.pathFilter() }),
      { wrapper: harness.Providers },
    );
    await act(async () => {
      expect(
        await result.current.mutations.createOrganization.mutateAsync({ name: "企業A" }),
      ).toEqual(organization);
    });
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(result.current.filter);
    invalidate.mockClear();
    await act(async () => {
      await result.current.mutations.updateOrganization.mutateAsync({
        ...organization,
        active: false,
      });
    });
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(result.current.filter);
    expect(harness.requests).toEqual([
      { path: "access.createOrganization", input: { name: "企業A" } },
      { path: "access.updateOrganization", input: { ...organization, active: false } },
    ]);
  });

  it("変更が拒否されたら更新エラーを保持し、アクセス関連データのキャッシュを無効化しない", async () => {
    const harness = createAccessTestHarness({
      "access.updateOrganization": { error: "この操作を行う権限がありません" },
    });
    const invalidate = vi.spyOn(harness.queryClient, "invalidateQueries");
    const { result } = renderHook(() => useOrganizationMutations(), { wrapper: harness.Providers });
    await act(async () => {
      await expect(result.current.updateOrganization.mutateAsync(organization)).rejects.toThrow(
        "この操作を行う権限がありません",
      );
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(harness.requests).toEqual([{ path: "access.updateOrganization", input: organization }]);
  });
});
