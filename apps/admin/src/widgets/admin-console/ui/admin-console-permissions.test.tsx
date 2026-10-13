import {
  AdminCreateOrganization,
  AdminOrganizations,
  AdminUsers,
} from "#admin/widgets/admin-console/index.ts";
import type { AppRouter } from "@dev-template/api-types";
import { ScopeMembers } from "@dev-template/client/access";
import {
  OrganizationScope,
  ServiceContext,
  shouldThrowQueryError,
  TRPCProvider,
} from "@dev-template/client/api";
import type { Service } from "@dev-template/client/api";
import type { Permission } from "@dev-template/client/entities/access";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { TestRouter } from "@dev-template/client/testing/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderReact,
  screen,
  waitFor,
} from "@testing-library/react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { ReactNode } from "react";
import { afterEach, expect, it } from "vite-plus/test";

const render = (ui: ReactNode, options?: Parameters<typeof renderReact>[1]) =>
  renderReact(<TestRouter>{ui}</TestRouter>, options);

// 各ページを同じキャッシュへ接続し、画面分離後も権限失効が別ページへ波及する契約を検証する。
function DirectoryPages() {
  return (
    <>
      <AdminOrganizations />
      <AdminUsers />
      <ScopeMembers scope="platform" platform />
    </>
  );
}

const privateEmail = "private-person@example.test";
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

type RequestState = {
  permissions: Permission[];
  service: Service;
  serverPermissions: Permission[];
  errors: Record<string, "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "NETWORK">;
  responses: number[];
  requests: string[];
};

function sessionData(state: RequestState) {
  return {
    userId: "operator-account",
    permissions: state.service === "business" ? [...state.permissions] : [],
    platformPermissions: state.service === "operator" ? [...state.permissions] : [],
    permissionCatalog: {},
  };
}

function memberData(service: Service) {
  return [
    {
      id: "member-membership",
      userId: "member-account",
      name: "Member Person",
      email: privateEmail,
      category: service === "operator" ? "operator" : "business",
      roleId: "reader",
      roleName: "Reader",
      protectedRole: false,
    },
  ];
}

function directoryData() {
  return {
    "access.businessIpPolicy": { enabled: false, allowedIps: [] },
    "access.organizationDirectory": [
      {
        id: "company-a",
        name: "Cached Company",
        active: true,
        invitationsEnabled: true,
        memberCount: 1,
      },
    ],
    "access.users": [
      {
        id: "user-account",
        name: "Directory Person",
        email: privateEmail,
        category: "business",
        memberships: [],
      },
    ],
  };
}

function roleAuditData() {
  return {
    "access.roles": [
      {
        id: "cached-role",
        name: "Cached role",
        protectedRole: false,
        permissions: ["member.read"],
      },
    ],
    "access.rolePermissionCatalog": { "member.read": "メンバー閲覧" },
    "access.audit": [
      {
        id: "audit-a",
        action: "Visible audit action",
        occurredAt: "2026-10-06",
        actorId: "operator-account",
        targetId: "company-a",
      },
    ],
  };
}

const required: Record<string, Permission> = {
  "access.organizationDirectory": "organization.read",
  "access.users": "user.read",
  "access.members": "member.read",
  "access.roles": "member.read",
  "access.rolePermissionCatalog": "role.manage",
  "access.audit": "audit.read",
};

function queryData(path: string, state: RequestState) {
  const data: Record<string, unknown> = {
    ...directoryData(),
    ...roleAuditData(),
    "access.organizationPlanOptions": [],
    "access.session": sessionData(state),
    "access.members": memberData(state.service),
  };
  return path === "access.organizationDirectory" ? { items: data[path], nextId: null } : data[path];
}

function resolveQuery(path: string, state: RequestState) {
  state.requests.push(path);
  const error =
    state.errors[path] ??
    (required[path] && !state.serverPermissions.includes(required[path]) ? "FORBIDDEN" : undefined);
  if (error === "NETWORK") {
    throw new Error("Network unavailable");
  }

  return error
    ? {
        error: {
          message: error,
          code: error === "FORBIDDEN" ? -32003 : -32603,
          data: { code: error, httpStatus: error === "FORBIDDEN" ? 403 : 500, path },
        },
      }
    : { result: { data: queryData(path, state) } };
}

function directoryTransport(state: RequestState): typeof fetch {
  return async (url) => {
    const href = url instanceof Request ? url.url : String(url);
    const paths = new URL(href).pathname.split("/").at(-1)!.split(",");
    const results = paths.map((path) => resolveQuery(path, state));
    // 同じHTTPバッチの成功と403を混在させ、1件の拒否で隣の成功セクションを隠さないか確認する。
    const status = results.some((result) => "error" in result) ? 207 : 200;
    state.responses.push(status);
    return new Response(JSON.stringify(results), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
}

function setup(
  permissions: Permission[],
  service: Service = "operator",
  // 表示用セッションとAPIの現在権限を分け、古い権限キャッシュでも各取得結果を優先する状況を作る。
  serverPermissions: Permission[] = permissions,
) {
  const state: RequestState = {
    permissions,
    service,
    serverPermissions,
    errors: {},
    responses: [],
    requests: [],
  };
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { throwOnError: shouldThrowQueryError, retry: false, staleTime: Infinity },
    },
  });
  clients.push(queryClient);
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "https://example.test/api/trpc",
        fetch: directoryTransport(state),
      }),
    ],
  });
  function wrapper(props: { children: ReactNode }) {
    return (
      <ServiceContext.Provider value={service}>
        <OrganizationScope id={service === "operator" ? "" : "tenant-page"}>
          <QueryClientProvider client={queryClient}>
            <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
              <DataErrorBoundary>{props.children}</DataErrorBoundary>
            </TRPCProvider>
          </QueryClientProvider>
        </OrganizationScope>
      </ServiceContext.Provider>
    );
  }
  return {
    queryClient,
    wrapper,
    requests: state.requests,
    errors: state.errors,
    responses: state.responses,
  };
}

it.each([
  {
    permission: "organization.read" as const,
    heading: "企業一覧",
    query: "access.organizationDirectory",
  },
  { permission: "user.read" as const, heading: "ユーザー一覧", query: "access.users" },
  { permission: "member.read" as const, heading: "メンバー・権限管理", query: "access.members" },
  { permission: "organization.manage" as const, heading: "企業を作成", query: "access.session" },
])(
  "運営画面の独立したセクション / 無関係な全体権限がなくても $permission の機能を利用できる",
  async (props) => {
    const app = setup([props.permission]);
    render(
      props.permission === "organization.manage" ? <AdminCreateOrganization /> : <DirectoryPages />,
      app,
    );
    expect(await screen.findByRole("heading", { name: props.heading })).toBeInTheDocument();
    expect(app.requests).toContain(props.query);
    if (props.permission !== "organization.manage") {
      expect(app.requests).toContain("access.organizationDirectory");
      expect(app.requests).toContain("access.users");
      expect(app.requests).toContain("access.members");
    }
  },
);

it("個人情報の閲覧権限 / 個人情報の閲覧権限が失われたら運営画面のキャッシュ済みメールを直ちに隠し、検索対象からも外す", async () => {
  const permissions: Permission[] = ["user.read", "member.read", "user.personal.read"];
  const app = setup(permissions);
  render(<DirectoryPages />, app);
  await waitFor(() => expect(screen.getAllByText(privateEmail)).toHaveLength(2));
  permissions.splice(permissions.indexOf("user.personal.read"), 1);
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: [["access", "session"]] });
  });
  await waitFor(() => expect(screen.queryAllByText(privateEmail)).toHaveLength(0));
  expect(screen.getByRole("heading", { name: "Directory Person" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Member Person" })).toBeInTheDocument();
  // ディレクトリキャッシュには意図的に以前のメールを残す。
  // 通信やキャッシュの掃除に頼らず、表示と検索が現在の権限へ従うことを確認する。
  const users = app.queryClient
    .getQueryCache()
    .find({ queryKey: [["access", "users"]], exact: false });
  expect(users?.state.data).toMatchObject([{ email: privateEmail }]);
  fireEvent.change(screen.getByRole("textbox", { name: "企業・ユーザーを検索" }), {
    target: { value: privateEmail },
  });
  expect(screen.queryByRole("heading", { name: "Directory Person" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "企業・ユーザーを検索" }), {
    target: { value: "Directory" },
  });
  expect(screen.getByRole("heading", { name: "Directory Person" })).toBeInTheDocument();
  expect(screen.queryByText(privateEmail)).not.toBeInTheDocument();
});

it("個人情報の閲覧権限 / 事業者向けの閲覧契約に従い、企業メンバーのメールを引き続き表示する", async () => {
  const app = setup(["member.read"], "business");
  render(<ScopeMembers scope="tenant-page" />, app);
  expect(await screen.findByText(privateEmail)).toBeInTheDocument();
});

it("クエリ単位のアクセス拒否 / キャッシュ済みの権限情報に閲覧権限がなくてもサーバーの結果を使う", async () => {
  const app = setup([], "operator", ["user.read", "audit.read"]);
  render(<DirectoryPages />, app);
  expect(await screen.findByRole("heading", { name: "Directory Person" })).toBeInTheDocument();
  expect(await screen.findByText(/Visible audit action/)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Cached Company")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "企業を作成" })).not.toBeInTheDocument();
  expect(screen.queryByText(privateEmail)).not.toBeInTheDocument();
  expect(app.responses).toContain(207);
});

it("クエリ単位のアクセス拒否 / 拒否された一覧のキャッシュを直ちに隠し、取得に成功した他の一覧は表示し続ける", async () => {
  const app = setup(["organization.read", "organization.manage", "user.read"]);
  render(<DirectoryPages />, app);
  await screen.findByText("Cached Company");
  await screen.findByRole("heading", { name: "Directory Person" });
  app.errors["access.organizationDirectory"] = "FORBIDDEN";
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: [["access", "organizationDirectory"]] });
  });
  await waitFor(() => expect(screen.queryByText("Cached Company")).not.toBeInTheDocument());
  expect(screen.queryByText("Cached Company")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Directory Person" })).toBeInTheDocument();
  expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument();
  const cached = app.queryClient
    .getQueryCache()
    .find({ queryKey: [["access", "organizationDirectory"]], exact: false });
  expect(cached?.state.data).toBeNull();
  const requestCount = app.requests.length;
  await act(async () => {
    await app.queryClient.invalidateQueries();
  });
  expect(app.requests.filter((path) => path === "access.organizationDirectory")).toHaveLength(2);
  expect(app.requests.length).toBeGreaterThan(requestCount);
});

it.each(["access.members", "access.roles", "access.audit"])(
  "クエリ単位のアクセス拒否 / 一度取得に成功した後は、拒否された %s のデータだけを隠す",
  async (path) => {
    const app = setup(["member.read", "audit.read", "role.manage"]);
    render(<DirectoryPages />, app);
    await screen.findByRole("heading", { name: "Member Person" });
    await screen.findByText(/Visible audit action/);
    await screen.findByRole("heading", { name: "Cached roleを編集" });
    app.errors[path] = "FORBIDDEN";
    await act(async () => {
      await app.queryClient.invalidateQueries({ queryKey: [path.split(".")] });
    });
    await waitFor(() =>
      expect(
        app.queryClient.getQueryCache().find({ queryKey: [path.split(".")], exact: false })?.state
          .data,
      ).toBeNull(),
    );
    if (path === "access.members") {
      await waitFor(() =>
        expect(screen.queryByRole("heading", { name: "Member Person" })).not.toBeInTheDocument(),
      );
      expect(screen.getByText(/Visible audit action/)).toBeInTheDocument();
    } else if (path === "access.audit") {
      await waitFor(() =>
        expect(screen.queryByText(/Visible audit action/)).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("heading", { name: "Member Person" })).toBeInTheDocument();
    } else {
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: "Cached roleを編集" }),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("heading", { name: "カスタムロール作成" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Member Person" })).toBeInTheDocument();
      expect(screen.getByText(/Visible audit action/)).toBeInTheDocument();
    }

    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument();
  },
);

it.each(["INTERNAL_SERVER_ERROR", "NETWORK"] as const)(
  "クエリ単位のアクセス拒否 / %s を権限不足と区別しBoundaryで捕捉する",
  async (error) => {
    const app = setup(["organization.read", "user.read"]);
    app.errors["access.organizationDirectory"] = error;
    render(<DirectoryPages />, app);
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent(
      "通信状況を確認して、もう一度お試しください。",
    );
    expect(screen.queryByText("Cached Company")).not.toBeInTheDocument();
  },
);
