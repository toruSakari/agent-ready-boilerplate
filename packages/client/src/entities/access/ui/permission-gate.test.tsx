import { DataErrorBoundary } from "#client/shared/ui/error-boundary";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { PermissionGate } from "#client/entities/access/ui/permission-gate";
import { hasPermissions } from "#client/entities/access/model/permissions";
import type { Permission } from "#client/entities/access/model/types";
import { ServiceContext } from "#client/shared/api/client-context";
import { TRPCProvider, useTRPC } from "#client/shared/api/trpc";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

function setup(
  permissions: Permission[] = [],
  options: { platformPermissions?: Permission[]; pending?: boolean; error?: string } = {},
) {
  const requests: string[] = [];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(queryClient);
  const trpcClient = createPermissionTransport(permissions, options, requests);
  const mounted = vi.fn();
  const unmounted = vi.fn();
  // マウント時に業務クエリも起動し、ガードが見た目だけを隠していないことを検証する。
  function ProtectedContent() {
    const trpc = useTRPC();
    useQuery(trpc.order.list.queryOptions({ service: "business" }));
    useEffect(() => {
      mounted();
      return () => unmounted();
    }, []);
    return <p>Protected content</p>;
  }
  function wrapper(props: { children: ReactNode }) {
    return (
      <ServiceContext.Provider value="business">
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <DataErrorBoundary>{props.children}</DataErrorBoundary>
          </TRPCProvider>
        </QueryClientProvider>
      </ServiceContext.Provider>
    );
  }
  return { wrapper, ProtectedContent, requests, mounted, unmounted, queryClient };
}

it("hasPermissionsの権限判定" + " / " + "既定では指定されたすべての権限を必要とする", () => {
  expect(hasPermissions(["order:read"], ["order:read", "product.read"])).toBe(false);
  expect(hasPermissions(["order:read", "product.read"], ["order:read", "product.read"])).toBe(true);
});

it("hasPermissionsの権限判定" + " / " + "anyが明示された場合だけいずれかの権限で許可する", () => {
  expect(hasPermissions(["order:read"], ["order:read", "product.read"], "any")).toBe(true);
  expect(hasPermissions([], ["order:read"], "any")).toBe(false);
  expect(hasPermissions([], [])).toBe(true);
  expect(hasPermissions([], [], "any")).toBe(false);
});

it(
  "PermissionGateの表示制御" +
    " / " +
    "権限の取得待ち中は子要素をマウントせず、そのクエリも開始しない",
  () => {
    const app = setup([], { pending: true });
    render(
      <PermissionGate required={["order:read"]}>
        <app.ProtectedContent />
      </PermissionGate>,
      app,
    );
    expect(screen.getByRole("status")).toHaveTextContent("データを読み込み中");
    expect(app.mounted).not.toHaveBeenCalled();
    expect(app.requests).toEqual(["access.session"]);
  },
);

it(
  "PermissionGateの表示制御" + " / " + "閲覧権限がなければ業務クエリを開始せずに拒否する",
  async () => {
    const app = setup(["order:create"]);
    render(
      <PermissionGate required={["order:read"]}>
        <app.ProtectedContent />
      </PermissionGate>,
      app,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("権限がありません");
    expect(app.mounted).not.toHaveBeenCalled();
    expect(app.requests).toEqual(["access.session"]);
  },
);

it(
  "PermissionGateの表示制御" + " / " + "anyが指定されなければページに必要なすべての権限を要求する",
  async () => {
    const app = setup(["order:read"]);
    const view = render(
      <PermissionGate required={["order:read", "product.read"]}>
        <app.ProtectedContent />
      </PermissionGate>,
      app,
    );
    await screen.findByRole("alert");
    expect(app.mounted).not.toHaveBeenCalled();
    view.rerender(
      <PermissionGate required={["order:read", "product.read"]} mode="any">
        <app.ProtectedContent />
      </PermissionGate>,
    );
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(app.requests).toEqual(["access.session", "order.list"]);
  },
);

it("PermissionGateの表示制御" + " / " + "運営権限の代わりに企業権限を使わない", async () => {
  const app = setup(["member.read"]);
  render(
    <PermissionGate required={["member.read"]} scope="platform">
      <app.ProtectedContent />
    </PermissionGate>,
    app,
  );
  await screen.findByRole("alert");
  expect(app.mounted).not.toHaveBeenCalled();
});

it("PermissionGateの表示制御" + " / " + "企業権限の代わりに運営権限を使わない", async () => {
  const app = setup([], { platformPermissions: ["order:read"] });
  render(
    <PermissionGate required={["order:read"]}>
      <app.ProtectedContent />
    </PermissionGate>,
    app,
  );
  await screen.findByRole("alert");
  expect(app.mounted).not.toHaveBeenCalled();
});

it(
  "PermissionGateの表示制御" + " / " + "無関係な全体権限がなくても指定された運営権限で許可する",
  async () => {
    const app = setup([], { platformPermissions: ["member.read"] });
    render(
      <PermissionGate required={["member.read"]} scope="platform">
        <app.ProtectedContent />
      </PermissionGate>,
      app,
    );
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  },
);

it(
  "PermissionGateの表示制御" +
    " / " +
    "成功時の権限データがキャッシュに残っていても再取得に失敗したら拒否する",
  async () => {
    const options = { error: "" };
    const app = setup(["order:read"], options);
    render(
      <PermissionGate required={["order:read"]}>
        <app.ProtectedContent />
      </PermissionGate>,
      app,
    );
    await screen.findByText("Protected content");
    options.error = "Session refresh denied";
    await act(async () => {
      await app.queryClient.invalidateQueries({ queryKey: [["access", "session"]] });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "通信状況を確認して、もう一度お試しください。",
    );
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    const session = app.queryClient
      .getQueryCache()
      .find({ queryKey: [["access", "session"]], exact: false });
    expect(session?.state.data).toMatchObject({ permissions: ["order:read"] });
    expect(app.unmounted).toHaveBeenCalledOnce();
  },
);

it(
  "PermissionGateの表示制御" + " / " + "更新後の権限が失われていれば内容をアンマウントする",
  async () => {
    const permissions: Permission[] = ["order:read"];
    const app = setup(permissions);
    render(
      <PermissionGate required={["order:read"]}>
        <app.ProtectedContent />
      </PermissionGate>,
      app,
    );
    await screen.findByText("Protected content");
    permissions.splice(0);
    await act(async () => {
      await app.queryClient.invalidateQueries({ queryKey: [["access", "session"]] });
    });
    await waitFor(() => expect(screen.queryByText("Protected content")).not.toBeInTheDocument());
    expect(app.unmounted).toHaveBeenCalledOnce();
  },
);

function createPermissionTransport(
  permissions: Permission[],
  options: { platformPermissions?: Permission[]; pending?: boolean; error?: string },
  requests: string[],
) {
  return createTRPCClient<AppRouter>({
    links: [
      () => (props) =>
        observable((observer) => {
          requests.push(props.op.path);
          if (props.op.path === "access.session") {
            if (options.error) {
              observer.error(new TRPCClientError(options.error));
            } else if (!options.pending) {
              observer.next({
                result: {
                  data: {
                    userId: "permission-user",
                    channel: "business",
                    permissions: [...permissions],
                    platformPermissions: options.platformPermissions ?? [],
                    organizations: [],
                    permissionCatalog: {},
                  },
                },
              });
              observer.complete();
            }
          } else {
            observer.next({ result: { data: [] } });
            observer.complete();
          }

          return () => {};
        }),
    ],
  });
}
