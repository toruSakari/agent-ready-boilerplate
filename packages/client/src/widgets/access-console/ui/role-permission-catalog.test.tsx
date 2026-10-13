import { ServiceContext } from "#client/shared/api/client-context";
import { shouldThrowQueryError } from "#client/shared/api/query-access";
import { TRPCProvider } from "#client/shared/api/trpc";
import { DataErrorBoundary } from "#client/shared/ui/error-boundary";
import { ScopeMembers } from "#client/widgets/access-console/ui/access-console";
import type { AppRouter } from "@dev-template/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { TRPCLink } from "@trpc/client";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";

vi.mock("#client/features/switch-theme", () => ({ ThemeMenu: () => null }));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

type CatalogResult = {
  data?: Record<string, string>;
  error?: string;
  forbidden?: boolean;
  pending?: boolean;
};

type CatalogOptions = { platform?: boolean; canManage?: boolean };

type CatalogRequest = { path: string; input: unknown };

function catalogSession(options: CatalogOptions, permissions: string[]) {
  return {
    userId: "actor-a",
    channel: options.platform ? "admin" : "business",
    organizations: [],
    permissions: options.platform ? [] : permissions,
    platformPermissions: options.platform ? permissions : [],
    permissionCatalog: {
      "order:read": "注文閲覧",
      "product.update": "商品管理",
      "plan.manage": "プランの割当管理",
    },
  };
}

function catalogMembers(service: string) {
  return [
    {
      id: "member-a",
      name: "閲覧できるメンバー",
      category: service,
      roleId: "custom-role",
      roleName: "担当者",
      email: null,
      userId: "user-a",
      protectedRole: false,
    },
  ];
}

function catalogQueryData(
  catalog: CatalogResult,
  options: CatalogOptions,
  permissions: string[],
  service: string,
): Record<string, unknown> {
  return {
    "access.session": catalogSession(options, permissions),
    "access.members": catalogMembers(service),
    "access.roles": [
      {
        id: "custom-role",
        name: "担当者",
        permissions: options.platform ? [] : ["product.update"],
        protectedRole: false,
      },
    ],
    "access.audit": [],
    "access.rolePermissionCatalog": catalog.data,
  };
}

function catalogTransport(
  catalog: CatalogResult,
  options: CatalogOptions,
  permissions: string[],
  service: string,
  requests: CatalogRequest[],
): TRPCLink<AppRouter> {
  return () => (props) =>
    observable((observer) => {
      requests.push({ path: props.op.path, input: props.op.input });
      if (props.op.path === "access.rolePermissionCatalog") {
        if (catalog.pending) {
          return () => {};
        }

        if (catalog.error) {
          observer.error(
            catalog.forbidden
              ? TRPCClientError.from({
                  error: {
                    message: catalog.error,
                    code: -32003,
                    data: { code: "FORBIDDEN", httpStatus: 403 },
                  },
                })
              : new TRPCClientError(catalog.error),
          );
          return () => {};
        }
      }

      const results = catalogQueryData(catalog, options, permissions, service);
      if (!(props.op.path in results)) {
        observer.error(new TRPCClientError(`Unexpected query: ${props.op.path}`));
      } else {
        observer.next({ result: { data: results[props.op.path] } });
        observer.complete();
      }

      return () => {};
    });
}

function setup(catalog: CatalogResult, options: { platform?: boolean; canManage?: boolean } = {}) {
  const service = options.platform ? "operator" : "business";
  const scope = options.platform ? "platform" : "company-a";
  const permissions =
    options.canManage === false ? ["member.read"] : ["member.read", "member.invite", "role.manage"];
  const requests: { path: string; input: unknown }[] = [];
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { throwOnError: shouldThrowQueryError, retry: false, staleTime: Infinity },
    },
  });
  clients.push(queryClient);
  const trpcClient = createTRPCClient<AppRouter>({
    links: [catalogTransport(catalog, options, permissions, service, requests)],
  });
  function wrapper(props: { children: ReactNode }) {
    return (
      <ServiceContext.Provider value={service}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <DataErrorBoundary>{props.children}</DataErrorBoundary>
          </TRPCProvider>
        </QueryClientProvider>
      </ServiceContext.Provider>
    );
  }
  render(<ScopeMembers scope={scope} platform={options.platform} />, { wrapper });
  return { requests, queryClient };
}

// 全権限の名称辞書と、対象scopeのプランで追加可能な権限カタログを混同しないことを画面で検証する。
it("ScopeMembersのロール権限一覧 / 作成時はサーバーの選択肢を使い、保存済み権限にだけセッションのラベルを使う", async () => {
  const app = setup({ data: { "order:read": "注文閲覧" } });
  const editors = await screen.findAllByLabelText("ロール名");
  expect(editors).toHaveLength(2);
  const createForm = editors[0]?.closest("form");
  const editForm = editors[1]?.closest("form");
  if (!createForm || !editForm) {
    throw new Error("Missing role editor forms");
  }

  expect(within(createForm).getByRole("checkbox", { name: "注文閲覧" })).toBeEnabled();
  expect(within(createForm).queryByRole("checkbox", { name: "商品管理" })).not.toBeInTheDocument();
  expect(within(editForm).getByRole("checkbox", { name: "商品管理" })).toBeChecked();
  expect(screen.queryByRole("checkbox", { name: "プランの割当管理" })).not.toBeInTheDocument();
  expect(app.requests).toContainEqual({
    path: "access.rolePermissionCatalog",
    input: { scope: "company-a", service: "business" },
  });
});

it("ScopeMembersのロール権限一覧 / role.manageがなければ権限一覧を要求しない", async () => {
  const app = setup({ data: {} }, { canManage: false });
  await screen.findByRole("heading", { name: "閲覧できるメンバー" });
  expect(app.requests.some((request) => request.path === "access.rolePermissionCatalog")).toBe(
    false,
  );
  expect(screen.queryByLabelText("ロール名")).not.toBeInTheDocument();
});

it("ScopeMembersのロール権限一覧 / 権限一覧の取得に成功するまで読み込み中と表示し、編集フォームを表示しない", async () => {
  setup({ pending: true });
  expect(
    await screen.findByRole("status", { name: "許可する操作を確認しています…" }),
  ).toBeVisible();
  expect(screen.queryByLabelText("ロール名")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "閲覧できるメンバー" })).toBeInTheDocument();
});

it("ScopeMembersのロール権限一覧 / ロール取得失敗は局所Boundaryで受け、招待とメンバー表示を残す", async () => {
  setup({ error: "プランの権限を取得できませんでした" });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "通信状況を確認して、もう一度お試しください。",
  );
  expect(screen.queryByLabelText("ロール名")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ユーザーを招待" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "閲覧できるメンバー" })).toBeInTheDocument();
});

it("ScopeMembersのロール権限一覧 / 新たに403が返されたら以前のキャッシュ済み選択肢も含めロール編集だけを隠す", async () => {
  const catalog: CatalogResult = { data: { "order:read": "注文閲覧" } };
  const app = setup(catalog);
  await screen.findAllByLabelText("ロール名");
  catalog.error = "権限がありません";
  catalog.forbidden = true;
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: [["access", "rolePermissionCatalog"]] });
  });
  await waitFor(() =>
    expect(screen.queryByRole("heading", { name: "カスタムロール作成" })).not.toBeInTheDocument(),
  );
  expect(screen.queryByLabelText("ロール名")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "閲覧できるメンバー" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ユーザーを招待" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "監査ログ（最新100件）" })).toBeInTheDocument();
});

it("ScopeMembersのロール権限一覧 / 運営の権限一覧で許可されていればplan.manageを選択できる", async () => {
  const app = setup({ data: { "plan.manage": "プランの割当管理" } }, { platform: true });
  expect(await screen.findAllByRole("checkbox", { name: "プランの割当管理" })).toHaveLength(2);
  expect(app.requests).toContainEqual({
    path: "access.rolePermissionCatalog",
    input: { scope: "platform", service: "operator" },
  });
});
