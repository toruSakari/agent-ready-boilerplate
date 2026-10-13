import { TestRouter } from "@dev-template/client/testing/router";
import type { ReactNode } from "react";
import { act, cleanup, render as renderReact, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { ServiceContext, OrganizationScope, TRPCProvider } from "@dev-template/client/api";
import type { Permission } from "@dev-template/client/entities/access";
import { BusinessNavigation } from "#business/widgets/business-navigation/index.ts";
import { afterEach, describe, expect, it } from "vite-plus/test";

const render = (ui: ReactNode) => renderReact(ui, { wrapper: TestRouter });

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

function renderNavigation(
  permissions: Permission[],
  variant: "console" | "dashboard" = "console",
  organizationId = "tenant-nav",
) {
  // セッションの再取得で権限だけを変え、マウントし直さずに失効したリンクが消えることを検証する。
  const state = { permissions };
  const requests: { path: string; input: unknown }[] = [];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(queryClient);
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      () => (props) =>
        observable((observer) => {
          requests.push({ path: props.op.path, input: props.op.input });
          observer.next({
            result: { data: { permissions: state.permissions, platformPermissions: [] } },
          });
          observer.complete();
          return () => {};
        }),
    ],
  });
  render(
    <ServiceContext.Provider value="business">
      <OrganizationScope id={organizationId}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <BusinessNavigation variant={variant} />
          </TRPCProvider>
        </QueryClientProvider>
      </OrganizationScope>
    </ServiceContext.Provider>,
  );
  return { queryClient, requests, state };
}

describe("BusinessNavigationの事業者向けナビゲーション", () => {
  it.each([
    { permissions: [], products: false, members: false },
    { permissions: ["product.read"], products: true, members: false },
    { permissions: ["member.read"], products: false, members: true },
    { permissions: ["product.read", "member.read"], products: true, members: true },
  ] satisfies { permissions: Permission[]; products: boolean; members: boolean }[])(
    "$permissions で個別に許可された移動先を表示する",
    async (props) => {
      const app = renderNavigation(props.permissions);
      await waitFor(() => expect(app.queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole("link", { name: "商品" }) !== null).toBe(props.products);
      expect(screen.queryByRole("link", { name: "メンバー・権限" }) !== null).toBe(props.members);
      expect(app.requests).toEqual([{ path: "access.session", input: { service: "business" } }]);
    },
  );

  it("注文ダッシュボードでも同じ許可済みの移動先を使う", async () => {
    renderNavigation(["product.read", "member.read"], "dashboard", "tenant /日本");
    expect(await screen.findByRole("link", { name: "商品" })).toHaveAttribute(
      "href",
      "/organizations/tenant%20%2F%E6%97%A5%E6%9C%AC/products",
    );
    expect(screen.getByRole("link", { name: "メンバー・権限" })).toHaveAttribute(
      "href",
      "/organizations/tenant%20%2F%E6%97%A5%E6%9C%AC/members",
    );
  });

  it("閲覧権限が失われた移動先を非表示にする", async () => {
    const app = renderNavigation(["product.read", "member.read"]);
    await screen.findByRole("link", { name: "商品" });
    app.state.permissions = ["member.read"];
    await act(async () => {
      await app.queryClient.invalidateQueries();
    });
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "商品" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "メンバー・権限" })).toHaveAttribute(
      "href",
      "/organizations/tenant-nav/members",
    );
  });
});
