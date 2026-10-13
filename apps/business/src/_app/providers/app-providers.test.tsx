import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { useTRPCClient, useService, useTRPC, useOrganizationId } from "@dev-template/client/api";
import { BusinessProviders } from "#business/_app/providers/app-providers.tsx";

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

// 古いクライアントも保持し、企業切替後に単独・バッチRPCのスコープがすり替わらないことを調べる。
const clients = new Map<QueryClient, ReturnType<typeof useTRPCClient>>();
let rpcFetch: ReturnType<typeof vi.fn<typeof fetch>>;
let imageFetch: ReturnType<typeof vi.fn<typeof fetch>>;

function ScopeProbe() {
  const service = useService();
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  const typedClient = useTRPCClient();
  const trpc = useTRPC();
  const health = useQuery(trpc.health.queryOptions({ service }));
  useEffect(() => {
    clients.set(queryClient, typedClient);
  }, [queryClient, typedClient]);
  useEffect(() => {
    mocks.mounted();
    return () => mocks.unmounted();
  }, []);
  return (
    <p data-testid="scope" data-organization-id={organizationId}>
      {health.isSuccess ? `Ready: ${service}` : "Loading scope"}
    </p>
  );
}

function app() {
  return (
    <BusinessProviders>
      <ScopeProbe />
    </BusinessProviders>
  );
}

function navigate(path: string, params: Record<string, string | string[] | undefined> | null = {}) {
  window.history.replaceState(null, "", path);
  mocks.params.mockReturnValue(params);
}

function latestClient() {
  return [...clients.keys()].at(-1)!;
}

function requestUrl(input: Parameters<typeof fetch>[0]) {
  return new URL(input instanceof Request ? input.url : String(input), window.location.origin);
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
  await clients.get(client)!.product.getImage.query({ service: "business", id: "product-1" });
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
  imageFetch = vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      result: { data: { base64: btoa("image"), contentType: "image/png", etag: "image-etag" } },
    }),
  );
  vi.stubGlobal("fetch", ((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes("/api/trpc/product.getImage")
      ? imageFetch(input, init)
      : rpcFetch(input, init);
  }) satisfies typeof fetch);
});
afterEach(() => {
  cleanup();
  clients.forEach((_transport, client) => client.clear());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  navigate("/");
});

it(
  "businessアプリが指定するプロバイダーのスコープ" +
    " / " +
    "画像の取得とFormDataは単独tRPCにし、通常のJSONはバッチのまま認証と企業を維持する",
  async () => {
    render(app());
    await screen.findByText("Ready: business");
    rpcFetch.mockClear().mockImplementation(async (input) => {
      const url = requestUrl(input);
      const result = { result: { data: { ok: true } } };
      return Response.json(
        url.searchParams.has("batch") ? url.pathname.split(",").map(() => result) : result,
      );
    });
    const client = clients.get(latestClient())!;
    const firstForm = new FormData();
    firstForm.set("id", "product-1");
    firstForm.set("file", new File(["first"], "first.png", { type: "image/png" }));
    const secondForm = new FormData();
    secondForm.set("id", "product-1");
    secondForm.set("file", new File(["second"], "second.webp", { type: "image/webp" }));
    await Promise.all([
      client.product.getImage.query({ service: "business", id: "product-1" }),
      client.product.getImage.query({ service: "business", id: "product-2" }),
      client.product.addImage.mutate(firstForm),
      client.product.replaceImage.mutate(secondForm),
      client.product.deleteImage.mutate({ id: "product-1", imageId: "image-1" }),
      client.product.deleteImage.mutate({ id: "product-1", imageId: "image-2" }),
      client.health.query({ service: "business" }),
      client.health.query({ service: "business" }),
    ]);
    verifyImageTransportRequests(firstForm, secondForm);
  },
);

it.each([
  { segment: "tenant%2Da", routeParam: "tenant-a", organizationId: "tenant-a" },
  { segment: "tenant%252Fa", routeParam: "tenant%2Fa", organizationId: "tenant%2Fa" },
  { segment: "tenant%25", routeParam: "tenant%", organizationId: "tenant%" },
  { segment: "tenant%2Fa", routeParam: "tenant/a", organizationId: "tenant/a" },
])(
  "businessアプリが指定するプロバイダーのスコープ" +
    " / " +
    "両方の通信処理を初期化する前にRouterで復号済みの企業ID $routeParam を通信へそのまま渡す",
  async (props) => {
    navigate(`/organizations/${props.segment}`, { organizationId: props.routeParam });
    render(app());
    expect(await screen.findByText("Ready: business")).toBeVisible();
    expect(rpcFetch).toHaveBeenCalledTimes(1);
    const request = rpcFetch.mock.calls[0]![0];
    const url = new URL(
      request instanceof Request ? request.url : String(request),
      window.location.origin,
    );
    expect(url.pathname).toBe("/api/trpc/health");
    expect(JSON.parse(url.searchParams.get("input") ?? "{}")).toEqual({
      "0": { service: "business" },
    });
    expect(rpcHeaders(0).get("x-organization-id")).toBe(props.organizationId);
    expect(screen.getByTestId("scope")).toHaveAttribute(
      "data-organization-id",
      props.organizationId,
    );
    await fetchImage();
    expect(imageHeaders(0).get("x-organization-id")).toBe(props.organizationId);
    expect(imageHeaders(0).get("authorization")).toBe("Bearer scope-token");
    expect(imageFetch.mock.calls[0]?.[1]?.cache).toBe("no-store");
  },
);

it.each([
  { name: "パラメーターなし", params: null },
  { name: "企業指定のないルート", params: {} },
  { name: "配列のパラメーター", params: { organizationId: ["tenant-a", "tenant-b"] } },
])(
  "businessアプリが指定するプロバイダーのスコープ" +
    " / " +
    "$name の場合はpathnameから企業を推測しない",
  async (props) => {
    navigate("/organizations/tenant-a", props.params);
    render(app());
    await screen.findByText("Ready: business");
    expect(rpcHeaders(0).has("x-organization-id")).toBe(false);
    await fetchImage();
    expect(imageHeaders(0).has("x-organization-id")).toBe(false);
  },
);

it(
  "businessアプリが指定するプロバイダーのスコープ" +
    " / " +
    "企業間の移動時にキャッシュと両方の通信処理を置き換え、以前の通信処理のスコープは維持する",
  async () => {
    const view = render(app());
    await screen.findByText("Ready: business");
    const previous = latestClient();
    previous.setQueryData(["private-data"], "tenant-a-only");
    navigate("/organizations/tenant-b/products", { organizationId: "tenant-b" });
    view.rerender(app());
    expect(screen.getByText("Loading scope")).toBeVisible();
    await screen.findByText("Ready: business");
    expect(latestClient()).not.toBe(previous);
    expect(latestClient().getQueryData(["private-data"])).toBeUndefined();
    await waitFor(() => expect(previous.getQueryCache().getAll()).toHaveLength(0));
    expect(rpcHeaders(0).get("x-organization-id")).toBe("tenant-a");
    expect(rpcHeaders(1).get("x-organization-id")).toBe("tenant-b");
    await fetchImage(previous);
    await fetchImage();
    expect(imageHeaders(0).get("x-organization-id")).toBe("tenant-a");
    expect(imageHeaders(1).get("x-organization-id")).toBe("tenant-b");
    expect(mocks.mounted).toHaveBeenCalledTimes(2);
    expect(mocks.unmounted).toHaveBeenCalledTimes(1);
  },
);

it.each(["/", "/account", "/sign-in", "/invitations/accept"])(
  "businessアプリが指定するプロバイダーのスコープ" +
    " / " +
    "%s では両方の通信処理とキャッシュから以前の企業のスコープを除く",
  async (path) => {
    const view = render(app());
    await screen.findByText("Ready: business");
    const previous = latestClient();
    previous.setQueryData(["private-data"], "tenant-a-only");
    navigate(path);
    view.rerender(app());
    await screen.findByText("Ready: business");
    expect(latestClient()).not.toBe(previous);
    expect(latestClient().getQueryData(["private-data"])).toBeUndefined();
    expect(rpcHeaders(1).has("x-organization-id")).toBe(false);
    await fetchImage();
    expect(imageHeaders(0).has("x-organization-id")).toBe(false);
    await waitFor(() => expect(previous.getQueryCache().getAll()).toHaveLength(0));
  },
);

it(
  "businessアプリが指定するプロバイダーのスコープ" +
    " / " +
    "同じ企業内のページ移動と戻る操作でキャッシュとマウント済みのページを維持する",
  async () => {
    const view = render(app());
    await screen.findByText("Ready: business");
    const initial = latestClient();
    initial.setQueryData(["private-data"], "retained-state");
    for (const path of ["/organizations/tenant-a/products", "/organizations/tenant-a"]) {
      navigate(path, { organizationId: "tenant-a" });
      view.rerender(app());
      expect(screen.getByText("Ready: business")).toBeVisible();
      expect(latestClient()).toBe(initial);
      expect(initial.getQueryData(["private-data"])).toBe("retained-state");
    }

    expect(rpcFetch).toHaveBeenCalledTimes(1);
    expect(mocks.mounted).toHaveBeenCalledTimes(1);
    expect(mocks.unmounted).not.toHaveBeenCalled();
  },
);

it(
  "businessアプリが指定するプロバイダーのスコープ" +
    " / " +
    "破棄した以前の企業への要求が遅れて完了しても、その企業のキャッシュを復元しない",
  async () => {
    // 旧企業の応答を新企業の描画後に返し、通信完了の順序が逆転する競合を再現する。
    const delayed = Promise.withResolvers<Response>();
    rpcFetch.mockReturnValueOnce(delayed.promise);
    const view = render(app());
    await waitFor(() => expect(rpcFetch).toHaveBeenCalledTimes(1));
    const previous = latestClient();
    navigate("/organizations/tenant-b", { organizationId: "tenant-b" });
    view.rerender(app());
    await screen.findByText("Ready: business");
    const current = latestClient();
    expect(current).not.toBe(previous);
    await act(async () => delayed.resolve(healthy()));
    expect(latestClient()).toBe(current);
    expect(previous.getQueryCache().getAll()).toHaveLength(0);
    expect(current.getQueryCache().getAll()).toHaveLength(1);
    expect(rpcHeaders(1).get("x-organization-id")).toBe("tenant-b");
    expect(screen.getByText("Ready: business")).toBeVisible();
  },
);

function verifyImageTransportRequests(firstForm: FormData, secondForm: FormData) {
  expect(imageFetch).toHaveBeenCalledTimes(2);
  for (const [input, init] of imageFetch.mock.calls) {
    const url = requestUrl(input);
    expect(url.pathname).toBe("/api/trpc/product.getImage");
    expect(url.searchParams.has("batch")).toBe(false);
    expect(init?.cache).toBe("no-store");
  }

  const uploads = rpcFetch.mock.calls.filter((props) => {
    const [, init] = props;
    return init?.body instanceof FormData;
  });
  expect(uploads.map((props) => requestUrl(props[0]).pathname)).toEqual([
    "/api/trpc/product.addImage",
    "/api/trpc/product.replaceImage",
  ]);
  expect(
    uploads.map((props) => {
      const [, init] = props;
      return init?.body;
    }),
  ).toEqual([firstForm, secondForm]);
  for (const [input, init] of uploads) {
    expect(requestUrl(input).searchParams.has("batch")).toBe(false);
    expect(new Headers(init?.headers).has("content-type")).toBe(false);
    expect(init?.cache).toBe("no-store");
  }

  const jsonRequests = rpcFetch.mock.calls.filter((props) => {
    const [, init] = props;
    return !(init?.body instanceof FormData);
  });
  expect(jsonRequests.map((props) => requestUrl(props[0]).pathname)).toEqual([
    "/api/trpc/product.deleteImage,product.deleteImage",
    "/api/trpc/health,health",
  ]);
  for (const [input] of jsonRequests) {
    expect(requestUrl(input).searchParams.get("batch")).toBe("1");
  }

  for (const [, init] of [...rpcFetch.mock.calls, ...imageFetch.mock.calls]) {
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer scope-token");
    expect(new Headers(init?.headers).get("x-organization-id")).toBe("tenant-a");
  }
}
