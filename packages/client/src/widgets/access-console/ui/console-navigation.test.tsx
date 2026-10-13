import { TestRouter } from "@dev-template/client/testing/router";
import type { ReactNode } from "react";
import { cleanup, render as renderReact, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { Permission } from "#client/entities/access";
import { ConsoleLayout, PermissionDeniedPage } from "#client/widgets/access-console";
import { ServiceContext, OrganizationScope } from "#client/shared/api/client-context";
import type { Service } from "#client/shared/api/client-context";
import { TRPCProvider } from "#client/shared/api/trpc";

const render = (ui: ReactNode) => renderReact(ui, { wrapper: TestRouter });

vi.mock("#client/features/switch-theme", () => ({ ThemeMenu: () => null }));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

function renderNavigation(service: Service, permissions: Permission[], navigation?: ReactNode) {
  const requests: string[] = [];
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queryClient);
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      () => (props) =>
        observable((observer) => {
          requests.push(props.op.path);
          observer.next({ result: { data: { permissions, platformPermissions: [] } } });
          observer.complete();
          return () => {};
        }),
    ],
  });
  render(
    <ServiceContext.Provider value={service}>
      <OrganizationScope id="tenant-nav">
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <ConsoleLayout title="Navigation test" navigation={navigation}>
              Content
            </ConsoleLayout>
          </TRPCProvider>
        </QueryClientProvider>
      </OrganizationScope>
    </ServiceContext.Provider>,
  );
  return requests;
}

// 共有メニューとアプリから渡される導線を分け、運営から企業権限へフォールバックしないことを検証する。
it("ConsoleLayoutのナビゲーション" + " / " + "公開の招待画面ではセッションを取得しない", () => {
  // 公開導線がセッションを取得しないことを確かめるため、QueryとtRPCのProviderを意図的に置かない。
  render(
    <ServiceContext.Provider value="business">
      <OrganizationScope id="">
        <ConsoleLayout title="招待を承諾">Invitation content</ConsoleLayout>
      </OrganizationScope>
    </ServiceContext.Provider>,
  );
  expect(screen.getByText("Invitation content")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "登録情報・退会" })).toHaveAttribute("href", "/account");
  expect(screen.getByRole("link", { name: "企業選択・ホーム" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("link", { name: "注文" })).not.toBeInTheDocument();
});

it.each(["customer", "business"] as const)(
  "ConsoleLayoutのナビゲーション" + " / " + "%s サービスでは共通の注文への移動先だけを受け持つ",
  async (service) => {
    renderNavigation(service, ["order:read", "product.read", "member.read"]);
    expect(await screen.findByRole("link", { name: "注文" })).toHaveAttribute(
      "href",
      "/organizations/tenant-nav",
    );
    expect(screen.queryByRole("link", { name: "商品" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "メンバー・権限" })).not.toBeInTheDocument();
  },
);

it(
  "ConsoleLayoutのナビゲーション" + " / " + "注文の閲覧権限がなければ注文への導線を表示しない",
  () => {
    const requests = renderNavigation("business", ["product.read", "member.read"]);
    expect(screen.queryByRole("link", { name: "注文" })).not.toBeInTheDocument();
    expect(requests).toEqual(["access.session"]);
  },
);

it(
  "ConsoleLayoutのナビゲーション" + " / " + "所有アプリから渡されたナビゲーションを表示する",
  async () => {
    renderNavigation("business", ["order:read"], <a href="/application-page">App destination</a>);
    await screen.findByRole("link", { name: "注文" });
    expect(screen.getByRole("link", { name: "App destination" })).toHaveAttribute(
      "href",
      "/application-page",
    );
  },
);

it(
  "ConsoleLayoutのナビゲーション" +
    " / " +
    "アプリのナビゲーションをアクセス拒否画面のレイアウトへ渡す",
  () => {
    render(<PermissionDeniedPage navigation={<a href="/application-page">App destination</a>} />);
    expect(screen.getByRole("alert")).toHaveTextContent("権限がありません");
    expect(screen.getByRole("link", { name: "App destination" })).toBeInTheDocument();
  },
);

it(
  "ConsoleLayoutのナビゲーション" +
    " / " +
    "運営サービスでは企業内のページへの導線を表示せず、企業権限も取得しない",
  () => {
    const requests = renderNavigation("operator", ["order:read", "product.read", "member.read"]);
    expect(screen.queryByRole("link", { name: "注文" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "商品" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "メンバー・権限" })).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  },
);
