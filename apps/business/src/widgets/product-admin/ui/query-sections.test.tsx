import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import {
  shouldThrowQueryError,
  ServiceContext,
  OrganizationScope,
  TRPCProvider,
} from "@dev-template/client/api";
import { TestRouter } from "@dev-template/client/testing/router";
import type { ReactNode, ComponentType } from "react";
import { act, cleanup, render as renderReact, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { OrderDashboard } from "@dev-template/client/order-dashboard";
import { ProductAdmin } from "#business/widgets/product-admin/index.ts";
import { afterEach, describe, expect, it } from "vite-plus/test";

const render = (ui: ReactNode) => renderReact(ui, { wrapper: TestRouter });

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
const cases = [
  {
    name: "注文",
    Component: OrderDashboard,
    path: "order.list",
    section: "注文管理",
    cachedName: "Cached order item",
    data: [
      {
        id: "order-a",
        tenantId: "tenant-a",
        customerId: "customer-a",
        status: "draft",
        statusLabel: "下書き",
        lines: [{ sku: "SKU-A", name: "Cached order item", quantity: 1, unitPrice: 100 }],
        total: 100,
        createdAt: "2026-10-06T00:00:00Z",
        version: 1,
        reservationId: null,
        paymentStatus: null,
      },
    ],
  },
  {
    name: "商品",
    Component: ProductAdmin,
    path: "product.list",
    section: "商品一覧",
    cachedName: "Cached product",
    data: [
      {
        id: "product-a",
        tenantId: "tenant-a",
        sku: "SKU-A",
        name: "Cached product",
        unitPrice: 100,
        imageKey: null,
        images: [],
        createdAt: "2026-10-06T00:00:00Z",
      },
    ],
  },
];

function setup(Component: ComponentType, path: string, data: unknown) {
  const state = { error: undefined as "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | undefined };
  const requests: string[] = [];
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { throwOnError: shouldThrowQueryError, retry: false, staleTime: Infinity },
    },
  });
  clients.push(queryClient);
  const trpcClient = createSectionTransport(path, data, state, requests);
  render(
    <ServiceContext.Provider value="business">
      <OrganizationScope id="tenant-a">
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <DataErrorBoundary>
              <Component />
            </DataErrorBoundary>
          </TRPCProvider>
        </QueryClientProvider>
      </OrganizationScope>
    </ServiceContext.Provider>,
  );
  return { queryClient, requests, state };
}

describe.each(cases)("$name の取得セクション", (props) => {
  it("403となったセクションとそのキャッシュ済みデータだけを隠し、ページの他の部分は隠さない", async () => {
    const app = setup(props.Component, props.path, props.data);
    await screen.findByText(props.cachedName);
    // 成功後の403でキャッシュを非表示のnullへ置き換え、古い情報が復活しないか調べる。
    app.state.error = "FORBIDDEN";
    await act(async () => {
      await app.queryClient.invalidateQueries({ queryKey: [props.path.split(".")] });
    });
    await waitFor(() => expect(screen.queryByText(props.cachedName)).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: props.section })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: props.section })).not.toBeInTheDocument();
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: props.Component === ProductAdmin ? "設定" : "登録情報・退会",
      }),
    ).toBeInTheDocument();
    expect(
      app.queryClient.getQueryCache().find({ queryKey: [props.path.split(".")], exact: false })
        ?.state.data,
    ).toBeNull();
    await act(async () => {
      await app.queryClient.invalidateQueries();
    });
    expect(app.requests.filter((request) => request === props.path)).toHaveLength(2);
    // 権限の更新によるreset後は再照会し、拒否のnullから回復できる。
    app.state.error = undefined;
    await act(async () => {
      await app.queryClient.resetQueries({ queryKey: [props.path.split(".")] });
    });
    expect(await screen.findByText(props.cachedName)).toBeVisible();
    expect(app.requests.filter((request) => request === props.path)).toHaveLength(3);
  });
  it("500エラーはBoundaryへ渡し、内部文言と古いデータを表示しない", async () => {
    const app = setup(props.Component, props.path, props.data);
    await screen.findByText(props.cachedName);
    app.state.error = "INTERNAL_SERVER_ERROR";
    await act(async () => {
      await app.queryClient.invalidateQueries({ queryKey: [props.path.split(".")] });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "通信状況を確認して、もう一度お試しください。",
    );
    expect(screen.queryByText(props.cachedName)).not.toBeInTheDocument();
    expect(screen.queryByText("INTERNAL_SERVER_ERROR")).not.toBeInTheDocument();
  });
});

function createSectionTransport(
  path: string,
  data: unknown,
  state: { error: "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | undefined },
  requests: string[],
) {
  return createTRPCClient<AppRouter>({
    links: [
      () => (props) =>
        observable((observer) => {
          requests.push(props.op.path);
          if (props.op.path === path && state.error) {
            observer.error(
              TRPCClientError.from({
                error: {
                  message: state.error,
                  code: state.error === "FORBIDDEN" ? -32003 : -32603,
                  data: {
                    code: state.error,
                    httpStatus: state.error === "FORBIDDEN" ? 403 : 500,
                  },
                },
              }),
            );
          } else {
            observer.next({
              result: {
                data:
                  props.op.path === "access.session"
                    ? {
                        userId: "account-a",
                        permissions: [],
                        platformPermissions: [],
                        permissionCatalog: {},
                      }
                    : data,
              },
            });
            observer.complete();
          }

          return () => {};
        }),
    ],
  });
}
