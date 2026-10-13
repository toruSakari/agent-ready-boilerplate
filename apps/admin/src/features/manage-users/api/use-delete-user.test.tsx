import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useTRPC } from "@dev-template/client/api";
import { createAccessTestHarness } from "#admin/test/access-harness.tsx";
import { useDeleteUser } from "#admin/features/manage-users/api/use-delete-user.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 削除対象はサービス会員IDで固定し、成功時の再取得と最後の管理者などのAPI拒否を別々に確認する。
describe("運営によるサービス会員の削除", () => {
  it("指定したサービス会員の削除後にすべてのアクセス関連データのキャッシュを無効化する", async () => {
    const harness = createAccessTestHarness({ "access.deleteUser": { data: undefined } });
    const invalidate = vi.spyOn(harness.queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => ({ mutation: useDeleteUser(), filter: useTRPC().access.pathFilter() }),
      { wrapper: harness.Providers },
    );
    await act(async () => {
      await result.current.mutation.mutateAsync({ userId: "business-account-a" });
    });
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(result.current.filter);
    expect(harness.requests).toEqual([
      { path: "access.deleteUser", input: { userId: "business-account-a" } },
    ]);
  });

  it("サーバーの拒否を保持し、アクセス関連データのキャッシュを無効化しない", async () => {
    const harness = createAccessTestHarness({
      "access.deleteUser": { error: "最後の管理者は削除できません" },
    });
    const invalidate = vi.spyOn(harness.queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteUser(), { wrapper: harness.Providers });
    await act(async () => {
      await expect(result.current.mutateAsync({ userId: "operator-account-a" })).rejects.toThrow(
        "最後の管理者は削除できません",
      );
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(harness.requests).toEqual([
      { path: "access.deleteUser", input: { userId: "operator-account-a" } },
    ]);
  });
});
