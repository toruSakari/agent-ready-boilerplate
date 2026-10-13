import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type { z } from "zod";
import {
  orderListSearchSchema,
  organizationListSearchSchema,
  storeListSearchSchema,
} from "#client/widgets/list-filters/model/list-search.ts";
import type { ListSearch } from "#client/widgets/list-filters/model/list-search.ts";
import { useListSearch } from "#client/widgets/list-filters/model/use-list-search.ts";

beforeEach(() => {
  // jsdomにないスクロールAPIだけを補い、Routerの履歴購読と検索更新は実処理で検証する。
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderSearch<T extends ListSearch>(schema: z.ZodType<T>, initialEntry: string) {
  const root = createRootRoute();
  const route = createRoute({
    getParentRoute: () => root,
    path: "/organizations/$organizationId/orders",
    validateSearch: schema,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    isServer: false,
  });
  await router.load();
  const hook = renderHook(() => useListSearch(schema), {
    wrapper: (props) => (
      <RouterContextProvider router={router}>
        <RouterProvider router={router} />
        {props.children}
      </RouterContextProvider>
    ),
  });
  return { router, result: hook.result };
}

it("注文の検索更新は現在のパスと企業IDを保ち、戻る操作で元の条件を復元する", async () => {
  const { router, result } = await renderSearch(
    orderListSearchSchema,
    "/organizations/tenant-a/orders?status=draft",
  );
  expect(result.current.value).toEqual({ status: "draft" });
  act(() => result.current.change({ q: " 注文 ", status: "confirmed", sort: "oldest" }));
  await waitFor(() =>
    expect(result.current.value).toEqual({ q: "注文", status: "confirmed", sort: "oldest" }),
  );
  expect(router.state.location.pathname).toBe("/organizations/tenant-a/orders");
  expect(router.state.matches.at(-1)?.params).toEqual({ organizationId: "tenant-a" });
  expect(result.current.key).toBe(JSON.stringify(result.current.value));
  act(() => router.history.back());
  await waitFor(() => expect(result.current.value).toEqual({ status: "draft" }));
});

it("企業検索には企業状態を使い、条件を消しても別のルートへ遷移しない", async () => {
  const { router, result } = await renderSearch(
    organizationListSearchSchema,
    "/organizations/tenant-a/orders?status=active&planCode=standard",
  );
  expect(result.current.value).toEqual({ status: "active", planCode: "standard" });
  act(() => result.current.change({ status: "inactive" }));
  await waitFor(() => expect(result.current.value).toEqual({ status: "inactive" }));
  act(() => result.current.change({}));
  await waitFor(() => expect(result.current.value).toEqual({}));
  expect(router.state.location.pathname).toBe("/organizations/tenant-a/orders");
  expect(router.state.location.searchStr).toBe("");
});

it("注文と企業の状態を混同した更新を、URLを書き換える前に拒否する", async () => {
  const order = await renderSearch(
    orderListSearchSchema,
    "/organizations/tenant-a/orders?status=draft",
  );
  expect(() => order.result.current.change({ status: "active" })).toThrow();
  expect(order.router.state.location.search).toEqual({ status: "draft" });
  const organization = await renderSearch(
    organizationListSearchSchema,
    "/organizations/tenant-a/orders?status=active",
  );
  expect(() => organization.result.current.change({ status: "confirmed" })).toThrow();
  expect(organization.router.state.location.search).toEqual({ status: "active" });
});

it("価格のURL入力を数値へ正規化し、逆転した価格条件の更新を拒否する", async () => {
  const { router, result } = await renderSearch(
    storeListSearchSchema,
    "/organizations/tenant-a/orders?minPrice=0&maxPrice=100",
  );
  expect(result.current.value).toEqual({ minPrice: 0, maxPrice: 100 });
  expect(() => result.current.change({ minPrice: 200, maxPrice: 100 })).toThrow();
  act(() => result.current.change({ minPrice: 10, maxPrice: 200, stock: "in-stock" }));
  await waitFor(() =>
    expect(result.current.value).toEqual({ minPrice: 10, maxPrice: 200, stock: "in-stock" }),
  );
  expect(router.state.location.pathname).toBe("/organizations/tenant-a/orders");
});
