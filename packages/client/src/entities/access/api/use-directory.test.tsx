import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useRolePermissionCatalog } from "#client/entities/access/api/use-directory";
import { ServiceContext } from "#client/shared/api/client-context";
import { TRPCProvider } from "#client/shared/api/trpc";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

function setup(service: "business" | "operator", response: { forbidden?: boolean } = {}) {
  const requests: { path: string; input: unknown }[] = [];
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queryClient);
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      () => (props) =>
        observable((observer) => {
          requests.push({ path: props.op.path, input: props.op.input });
          if (response.forbidden) {
            observer.error(
              TRPCClientError.from({
                error: {
                  message: "権限がありません",
                  code: -32003,
                  data: { code: "FORBIDDEN", httpStatus: 403 },
                },
              }),
            );
          } else {
            observer.next({ result: { data: { "order:read": "注文閲覧" } } });
            observer.complete();
          }

          return () => {};
        }),
    ],
  });
  function wrapper(props: { children: ReactNode }) {
    return (
      <ServiceContext.Provider value={service}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            {props.children}
          </TRPCProvider>
        </QueryClientProvider>
      </ServiceContext.Provider>
    );
  }
  return { wrapper, queryClient, requests };
}

describe("useRolePermissionCatalogのロール権限一覧取得", () => {
  it.each(["business", "operator"] as const)(
    "%s サービスで有効にされたスコープだけを取得する",
    async (service) => {
      const app = setup(service);
      const view = renderHook((props) => useRolePermissionCatalog(props.scope, props.enabled), {
        wrapper: app.wrapper,
        initialProps: { scope: "scope-a", enabled: false },
      });
      expect(app.requests).toEqual([]);
      view.rerender({ scope: "scope-a", enabled: true });
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
      expect(app.requests).toEqual([
        { path: "access.rolePermissionCatalog", input: { scope: "scope-a", service } },
      ]);
      view.rerender({ scope: "scope-b", enabled: false });
      expect(view.result.current.data).toBeUndefined();
      expect(app.requests).toHaveLength(1);
      view.rerender({ scope: "scope-b", enabled: true });
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
      expect(app.requests[1]).toEqual({
        path: "access.rolePermissionCatalog",
        input: { scope: "scope-b", service },
      });
    },
  );

  // 単なるinvalidateでは拒否済み一覧を再試行せず、資格更新等のreset後にだけ再開することを確かめる。
  it("セクションを隠すメタデータを保持し、明示的にリセットされるまで拒否された取得を停止する", async () => {
    const response = { forbidden: true };
    const app = setup("business", response);
    const view = renderHook(() => useRolePermissionCatalog("company-a", true), {
      wrapper: app.wrapper,
    });
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    const query = app.queryClient
      .getQueryCache()
      .find({ queryKey: [["access", "rolePermissionCatalog"]], exact: false });
    expect(query?.meta).toEqual({ forbiddenBehavior: "hide-section" });
    await act(async () => {
      await app.queryClient.invalidateQueries();
    });
    expect(app.requests).toHaveLength(1);
    response.forbidden = false;
    await act(async () => {
      await app.queryClient.resetQueries();
    });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(app.requests).toHaveLength(2);
  });
});
