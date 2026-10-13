import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAuthenticatedFetch, useService, useTRPC } from "@dev-template/client/api";
import { WebProviders } from "#web/_app/providers/app-providers.tsx";

const mocks = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: true,
    userId: "scoped-user" as string | null,
    getToken: vi.fn<() => Promise<string | null>>(),
  },
  mounted: vi.fn(),
  unmounted: vi.fn(),
  params: vi.fn<() => Record<string, string | string[] | undefined> | null>(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useLocation: () => ({ pathname: window.location.pathname }),
  Outlet: () => null,
  useRouterState: (props: {
    select: (state: {
      matches: { params: Record<string, string | string[] | undefined> }[];
    }) => unknown;
  }) => props.select({ matches: [{ params: mocks.params() ?? {} }] }),
}));
vi.mock("next-themes", () => ({
  ThemeProvider: (props: { children: ReactNode }) => props.children,
}));
vi.mock("@clerk/react", () => ({
  ClerkProvider: (props: { children: ReactNode }) => props.children,
  useAuth: () => mocks.auth,
  SignIn: () => null,
}));

// 古い通信関数も保持し、企業切替後に新しいscopeへすり替わらないことをRPCと画像通信の両方で調べる。
const clients = new Map<QueryClient, ReturnType<typeof useAuthenticatedFetch>>();
let rpcFetch: ReturnType<typeof vi.fn<typeof fetch>>;
let imageFetch: ReturnType<typeof vi.fn<typeof fetch>>;

function ScopeProbe() {
  const service = useService();
  const queryClient = useQueryClient();
  const authenticatedFetch = useAuthenticatedFetch();
  const trpc = useTRPC();
  const health = useQuery(trpc.health.queryOptions({ service }));
  useEffect(() => {
    clients.set(queryClient, authenticatedFetch);
  }, [queryClient, authenticatedFetch]);
  useEffect(() => {
    mocks.mounted();
    return () => mocks.unmounted();
  }, []);
  return <p>{health.isSuccess ? `Ready: ${service}` : "Loading scope"}</p>;
}

function app() {
  return (
    <WebProviders>
      <ScopeProbe />
    </WebProviders>
  );
}

function navigate(path: string, params: Record<string, string | string[] | undefined> | null = {}) {
  window.history.replaceState(null, "", path);
  mocks.params.mockReturnValue(params);
}

function latestClient() {
  return [...clients.keys()].at(-1)!;
}

function rpcHeaders(index: number) {
  return new Headers(rpcFetch.mock.calls[index]?.[1]?.headers);
}

function imageHeaders(index: number) {
  return new Headers(imageFetch.mock.calls[index]?.[1]?.headers);
}

function healthy() {
  return Response.json([{ result: { data: { status: "ok" } } }]);
}

async function fetchImage(client = latestClient()) {
  await clients.get(client)!("/api/products/product-1/image?service=customer");
}

beforeEach(() => {
  clients.clear();
  window.sessionStorage.clear();
  navigate("/organizations/tenant-a", { organizationId: "tenant-a" });
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_scope");
  mocks.auth.isLoaded = true;
  mocks.auth.isSignedIn = true;
  mocks.auth.userId = "scoped-user";
  mocks.auth.getToken.mockReset().mockResolvedValue("scope-token");
  mocks.mounted.mockClear();
  mocks.unmounted.mockClear();
  rpcFetch = vi.fn<typeof fetch>().mockImplementation(async () => healthy());
  imageFetch = vi.fn<typeof fetch>().mockImplementation(async () => new Response("image"));
  vi.stubGlobal("fetch", ((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes("/api/trpc/") ? rpcFetch(input, init) : imageFetch(input, init);
  }) satisfies typeof fetch);
});
afterEach(() => {
  cleanup();
  clients.forEach((_transport, client) => client.clear());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  navigate("/");
});

describe("ストアの本人単位のプロバイダースコープ", () => {
  it("販売元の異なる商品を閲覧しても所属企業ヘッダーを送らずカートと本人キャッシュを維持する", async () => {
    const view = render(app());
    await screen.findByText("Ready: customer");
    const original = latestClient();
    original.setQueryData(["cart-view"], "retained");
    navigate("/products/tenant-b/item", { organizationId: "tenant-b" });
    view.rerender(app());
    expect(latestClient()).toBe(original);
    expect(original.getQueryData(["cart-view"])).toBe("retained");
    expect(rpcHeaders(0).has("x-organization-id")).toBe(false);
    await fetchImage();
    expect(imageHeaders(0).has("x-organization-id")).toBe(false);
    expect(imageHeaders(0).get("authorization")).toBe("Bearer scope-token");
  });
  it("別の本人へ切り替わると以前の注文キャッシュを破棄する", async () => {
    const view = render(app());
    await screen.findByText("Ready: customer");
    const original = latestClient();
    original.setQueryData(["private-orders"], "first-user-only");
    mocks.auth.userId = "other-user";
    view.rerender(app());
    await screen.findByText("Ready: customer");
    expect(latestClient()).not.toBe(original);
    expect(latestClient().getQueryData(["private-orders"])).toBeUndefined();
    await waitFor(() => expect(original.getQueryCache().getAll()).toHaveLength(0));
  });
});
