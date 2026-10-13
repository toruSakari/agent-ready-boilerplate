import { TestRouter } from "@dev-template/client/testing/router";
import type { ReactNode, ComponentType } from "react";
import { cleanup, render as renderReact, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ServiceContext, OrganizationScope, TRPCProvider } from "@dev-template/client/api";
import type { Permission } from "@dev-template/client/entities/access";
import { OrdersPage as OrderPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/orders/-page.tsx";
import { ProductsPage as ProductPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/products/-page.tsx";
import { MembersPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/members/-page.tsx";
import { HomePage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/-page.tsx";
import {
  BusinessOrderDetail,
  BusinessProductDetail,
} from "#business/widgets/business-workspace/index.ts";

const render = (ui: ReactNode) => renderReact(ui, { wrapper: TestRouter });

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

// widget単体ではなくルート入口を描画し、権限不足なら保護一覧を取得せずfallbackに導線が残るか確認する。
function renderPage(Page: ComponentType, permissions: Permission[]) {
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
              data: pageData(props.op.path, permissions),
            },
          });
          observer.complete();
          return () => {};
        }),
    ],
  });
  render(
    <ServiceContext.Provider value="business">
      <OrganizationScope id="tenant-page">
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <Page />
          </TRPCProvider>
        </QueryClientProvider>
      </OrganizationScope>
    </ServiceContext.Provider>,
  );
  return requests;
}

const pages = [
  {
    name: "注文",
    Page: OrderPage,
    permission: "order:read",
    query: "order.list",
    heading: "注文管理",
  },
  {
    name: "商品",
    Page: ProductPage,
    permission: "product.read",
    query: "product.list",
    heading: "商品管理",
  },
  {
    name: "メンバー",
    Page: MembersPage,
    permission: "member.read",
    query: "access.members",
    heading: "メンバー・権限",
  },
] satisfies {
  name: string;
  Page: ComponentType;
  permission: Permission;
  query: string;
  heading: string;
}[];

describe.each(pages)("事業者向けの $name ページの権限", (props) => {
  it("保護されたデータを取得せずにURLからの直接アクセスを拒否する", async () => {
    const requests = renderPage(props.Page, []);
    expect(await screen.findByRole("alert")).toHaveTextContent("権限がありません");
    expect(requests).toEqual(["access.session"]);
    expect(requests).not.toContain(props.query);
  });
  it("そのページの閲覧権限がある場合にページをマウントする", async () => {
    const requests = renderPage(props.Page, [props.permission]);
    expect(await screen.findByRole("heading", { name: props.heading })).toBeInTheDocument();
    expect(requests).toContain(props.query);
    expect(requests.filter((path) => path === "access.session")).toHaveLength(1);
  });
});

it.each([
  {
    permission: "product.read" as const,
    link: "商品",
    path: "/organizations/tenant-page/products",
  },
  {
    permission: "member.read" as const,
    link: "メンバー・権限",
    path: "/organizations/tenant-page/members",
  },
])(
  "一部の権限だけを持つロールの企業内ナビゲーション" +
    " / " +
    "$permission を持つロールで既定の注文ページから許可されたページへ移動できる",
  async (props) => {
    const requests = renderPage(OrderPage, [props.permission]);
    await screen.findByRole("alert");
    expect(await screen.findByRole("link", { name: props.link })).toHaveAttribute(
      "href",
      props.path,
    );
    expect(screen.queryByRole("link", { name: "注文" })).not.toBeInTheDocument();
    expect(requests).toEqual(["access.session"]);
  },
);

it(
  "事業者向けナビゲーションの組み込み" +
    " / " +
    "共通の注文ダッシュボードへ事業者向けの移動先を渡す",
  async () => {
    renderPage(OrderPage, ["order:read", "product.read", "member.read"]);
    await screen.findByRole("heading", { name: "注文管理" });
    expect(screen.getByRole("link", { name: "商品" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/products",
    );
    expect(screen.getByRole("link", { name: "メンバー・権限" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/members",
    );
    expect(screen.getByRole("link", { name: "企業を切り替える" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/settings",
    );
  },
);

it(
  "事業者向けナビゲーションの組み込み" +
    " / " +
    "共通のメンバー管理ナビゲーションとともに事業者向けの移動先を渡す",
  async () => {
    renderPage(MembersPage, ["order:read", "product.read", "member.read"]);
    await screen.findByRole("heading", { name: "メンバー・権限" });
    expect(screen.getByRole("link", { name: "商品" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/products",
    );
    expect(screen.getByRole("link", { name: "メンバー・権限" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/members",
    );
    expect(screen.getByRole("link", { name: "注文" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/orders",
    );
    expect(screen.getByRole("link", { name: "企業を切り替える" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/settings",
    );
  },
);

it.each([
  {
    Page: ProductPage,
    permission: "member.read" as const,
    link: "メンバー・権限",
    path: "/organizations/tenant-page/members",
  },
  {
    Page: MembersPage,
    permission: "product.read" as const,
    link: "商品",
    path: "/organizations/tenant-page/products",
  },
])(
  "事業者向けナビゲーションの組み込み" +
    " / " +
    "アクセスが拒否されたページでも許可済みの移動先を表示する",
  async (props) => {
    const requests = renderPage(props.Page, [props.permission]);
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: props.link })).toHaveAttribute("href", props.path);
    expect(requests).toEqual(["access.session"]);
  },
);

it(
  "企業ダッシュボードの責務" + " / " + "全集計を表示し、一覧や作成フォームを取得・表示しない",
  async () => {
    const requests = renderPage(HomePage, ["order:read", "product.read"]);
    expect(await screen.findByText("151")).toBeVisible();
    expect(screen.getByText("202")).toBeVisible();
    expect(requests).toEqual(["access.session", "dashboard.summary"]);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "注文" })).toHaveAttribute(
      "href",
      "/organizations/tenant-page/orders",
    );
  },
);

it(
  "企業ダッシュボードの責務" + " / " + "商品専用ロールでもトップから許可済みの作業へ進める",
  async () => {
    renderPage(HomePage, ["product.read"]);
    expect(await screen.findByText("202")).toBeVisible();
    expect(screen.queryByText("注文総数")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "注文" })).not.toBeInTheDocument();
  },
);

it.each([BusinessOrderDetail, BusinessProductDetail])(
  "企業ダッシュボードの責務" + " / " + "詳細の権限がないとget APIを呼ばない",
  async (Detail) => {
    function Page() {
      return <Detail id="private-id" />;
    }
    const requests = renderPage(Page, []);
    expect(await screen.findByRole("alert")).toHaveTextContent("権限がありません");
    expect(requests).toEqual(["access.session"]);
  },
);

function pageData(path: string, permissions: Permission[]) {
  if (path === "access.session") {
    return { permissions, platformPermissions: [], permissionCatalog: {} };
  }

  if (path === "dashboard.summary") {
    return {
      ordersTotal: permissions.includes("order:read") ? 151 : null,
      draftCount: permissions.includes("order:read") ? 3 : null,
      confirmedCount: permissions.includes("order:read") ? 100 : null,
      productsTotal: permissions.includes("product.read") ? 202 : null,
      membersTotal: null,
    };
  }

  return [];
}
