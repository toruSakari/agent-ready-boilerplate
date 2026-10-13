import { TestRouter } from "@dev-template/client/testing/router";
import type { ReactNode } from "react";
import { cleanup, render as renderReact, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ServiceContext, OrganizationScope, TRPCProvider } from "@dev-template/client/api";

import { OrdersPage as OrderPage } from "#app/routes/(web)/_authenticated/_qualified/orders/-page.tsx";

const render = (ui: ReactNode) => renderReact(ui, { wrapper: TestRouter });

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

// ルートを直接描画して、メニュー非表示だけでなく権限不足時のorder.list取得も止まることを観測する。
function renderPage() {
  const requests: string[] = [];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(queryClient);
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      () => (props) =>
        observable((observer) => {
          requests.push(props.op.path);
          observer.next({
            result: {
              data: { items: [], nextCursor: null },
            },
          });
          observer.complete();
          return () => {};
        }),
    ],
  });
  render(
    <ServiceContext.Provider value="customer">
      <OrganizationScope id="tenant-page">
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <OrderPage />
          </TRPCProvider>
        </QueryClientProvider>
      </OrganizationScope>
    </ServiceContext.Provider>,
  );
  return requests;
}

describe("一般顧客の注文履歴", () => {
  it("企業所属・業務権限の問い合わせなしに本人専用APIを使う", async () => {
    const requests = renderPage();
    expect(await screen.findByRole("heading", { name: "注文履歴" })).toBeVisible();
    expect(await screen.findByText("まだ注文はありません")).toBeVisible();
    expect(requests).toEqual(["store.listOrders"]);
    expect(screen.queryByText("注文管理")).not.toBeInTheDocument();
  });
});
