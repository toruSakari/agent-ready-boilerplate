import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { AuthenticationGate, ServiceQualificationGate } from "#client/_app/guards";
import { AppProviders } from "#client/_app/providers/app-providers";
import { ServiceAccount } from "#client/widgets/service-account";
import { useTRPC } from "#client/shared/api/trpc";
import type { Service } from "#client/shared/api/client-context";

const mocks = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: true,
    userId: "same-clerk-subject",
    getToken: async () => "token",
  },
  signIn: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useLocation: () => ({ pathname: window.location.pathname }),
}));
vi.mock("next-themes", () => ({
  ThemeProvider: (props: { children: ReactNode }) => props.children,
}));
vi.mock("#client/features/switch-theme", () => ({
  DEFAULT_THEME: "system",
  THEME_STORAGE_KEY: "test-theme",
  ThemeMenu: () => null,
}));
vi.mock("@clerk/react", () => ({
  ClerkProvider: (props: { children: ReactNode }) => props.children,
  useAuth: () => ({ ...mocks.auth, signOut: mocks.signOut }),
  useUser: () => ({ user: { delete: mocks.deleteUser } }),
  SignIn: (props: unknown) => {
    mocks.signIn(props);
    return <p>ログイン確認</p>;
  },
}));
const labels = { customer: "顧客", business: "事業者", operator: "運営" } as const;
// 同一Clerk subjectでもサービスごとに独立したキャッシュと登録状態を持たせる。
const clients = new Map<Service, QueryClient>();
let registered: Record<Service, boolean>;
let requests: ReturnType<typeof vi.fn<typeof fetch>>;

function success(data: unknown) {
  return Response.json([{ result: { data } }]);
}

function rejection(message: string) {
  return Response.json(
    [
      {
        error: {
          message,
          code: -32003,
          data: { code: "FORBIDDEN", errorCode: "LAST_OWNER_REQUIRED", httpStatus: 403 },
        },
      },
    ],
    { status: 403 },
  );
}

function navigate(path: string) {
  window.history.replaceState(null, "", path);
}

function mockLocationReplace() {
  const replace = vi.fn();
  const location = {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    origin: window.location.origin,
    replace,
  };
  vi.stubGlobal(
    "window",
    new Proxy(window, {
      get: (target, key) => (key === "location" ? location : Reflect.get(target, key)),
    }),
  );
  return replace;
}

// 退会やログアウト後に表示だけでなく旧データも消えたことを、Providerの実キャッシュで確認する。
function CacheProbe(props: { service: Service }) {
  const client = useQueryClient();
  useEffect(() => {
    clients.set(props.service, client);
    client.setQueryData(["private-orders"], [`${props.service}-historical-order`]);
  }, [client, props.service]);
  return null;
}

// 同じイベントで要求を発行し、通常ならバッチにまとまる条件でも単独RPCになることを検証する。
function ConcurrentLifecycle() {
  const trpc = useTRPC();
  const register = useMutation(trpc.access.registerCustomer.mutationOptions());
  const withdraw = useMutation(trpc.access.withdraw.mutationOptions());
  return (
    <button
      type="button"
      onClick={() =>
        void Promise.all([
          register.mutateAsync({ name: "並列リクエスト" }),
          withdraw.mutateAsync({ service: "customer" }),
        ])
      }
    >
      同時に送信
    </button>
  );
}

function accountPage(service: Service) {
  return (
    <AppProviders service={service}>
      <AuthenticationGate>
        <ServiceAccount />
        <CacheProbe service={service} />
      </AuthenticationGate>
    </AppProviders>
  );
}

function mutationCalls(procedure: string) {
  return requests.mock.calls.filter((props) => fetchUrl(props[0]).includes(procedure));
}

function fetchUrl(input: Parameters<typeof fetch>[0]) {
  return input instanceof Request ? input.url : String(input);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_service_account");
  window.sessionStorage.clear();
  navigate("/register");
  mocks.auth.isLoaded = true;
  mocks.auth.isSignedIn = true;
  mocks.signIn.mockReset();
  mocks.signOut.mockReset();
  mocks.deleteUser.mockReset();
  registered = { customer: false, business: true, operator: true };
  clients.clear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  requests = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = fetchUrl(input);
    const payload = JSON.parse(
      typeof init?.body === "string"
        ? init.body
        : (new URL(url, window.location.origin).searchParams.get("input") ?? "{}"),
    );
    const service: Service = payload["0"]?.service ?? "customer";
    expect(new URL(url, window.location.origin).pathname).toMatch(/^\/api\/trpc\//);
    if (url.includes("access.registration")) {
      return success({
        registered: registered[service],
        category: service,
        accountId: registered[service] ? `${service}-account` : null,
      });
    }

    if (url.includes("access.registerCustomer")) {
      registered.customer = true;
      return success({ accountId: "new-customer-account" });
    }

    if (url.includes("access.withdraw")) {
      registered[service] = false;
      return success({ category: service });
    }

    throw new Error(`Unexpected protected request: ${url}`);
  });
  vi.stubGlobal("fetch", requests);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it(
  "利用者の明示的な操作による顧客登録" +
    " / " +
    "同時に待ち行列へ入っても会員の登録・退会操作をそれぞれ正しい個別のRPCで送信する",
  async () => {
    navigate("/account");
    render(
      <AppProviders service="customer">
        <AuthenticationGate>
          <ConcurrentLifecycle />
        </AuthenticationGate>
      </AppProviders>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "同時に送信" }));
    await waitFor(() => expect(requests).toHaveBeenCalledTimes(2));
    expect(mutationCalls("access.registerCustomer")).toHaveLength(1);
    expect(mutationCalls("access.withdraw")).toHaveLength(1);
    for (const [input] of requests.mock.calls) {
      expect(fetchUrl(input)).not.toContain(",");
    }
  },
);

it.each(["customer", "business", "operator"] as const)(
  "本人確認が必要な会員情報画面" +
    " / " +
    "%s の認証を待ち、ログアウト済みなら要求を送る前に会員情報画面から転送する",
  async (service) => {
    navigate("/account");
    const replace = mockLocationReplace();
    mocks.auth.isLoaded = false;
    const view = render(accountPage(service));
    expect(await screen.findByText("認証情報を確認しています…")).toBeVisible();
    expect(requests).not.toHaveBeenCalled();
    expect(clients.size).toBe(0);
    mocks.auth.isLoaded = true;
    mocks.auth.isSignedIn = false;
    view.rerender(accountPage(service));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in?returnTo=%2Faccount"));
    expect(requests).not.toHaveBeenCalled();
    expect(clients.size).toBe(0);
  },
);

it(
  "本人確認が必要な会員情報画面" +
    " / " +
    "ログアウト後にuserIdの更新が遅れても直ちに転送し、キャッシュ済みの会員情報を破棄する",
  async () => {
    navigate("/account");
    const replace = mockLocationReplace();
    const view = render(accountPage("business"));
    await screen.findByRole("button", { name: "事業者サービスを退会する" });
    const oldClient = clients.get("business")!;
    expect(oldClient.getQueryData(["private-orders"])).toEqual(["business-historical-order"]);
    mocks.auth.isSignedIn = false;
    view.rerender(accountPage("business"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in?returnTo=%2Faccount"));
    expect(
      screen.queryByRole("button", { name: "事業者サービスを退会する" }),
    ).not.toBeInTheDocument();
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mutationCalls("access.session")).toHaveLength(0);
  },
);

it.each(["customer", "business", "operator"] as const)(
  "本人確認が必要な会員情報画面" +
    " / " +
    "認証済みで未登録の %s 利用者もサービスの利用資格なしで会員情報画面を開ける",
  async (service) => {
    navigate("/account");
    registered[service] = false;
    render(accountPage(service));
    expect(
      await screen.findByRole("heading", {
        name:
          service === "customer" ? "会員登録が必要です" : `${labels[service]}サービスは未登録です`,
      }),
    ).toBeVisible();
    expect(mutationCalls("access.registration")).toHaveLength(1);
    expect(mutationCalls("access.session")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "会員登録へ進む" })).not.toBeInTheDocument();
    if (service !== "customer") {
      expect(screen.getByText(/招待リンクから登録してください/)).toBeVisible();
    }
  },
);

it(
  "本人確認が必要な会員情報画面" +
    " / " +
    "会員の登録・退会の流れを変えずに呼び出し元から渡された未登録時の内容を表示する",
  async () => {
    navigate("/account");
    render(
      <AppProviders service="customer">
        <AuthenticationGate>
          <ServiceAccount missingRegistrationContent={<p>この画面の登録案内</p>} />
        </AuthenticationGate>
      </AppProviders>,
    );
    expect(await screen.findByText("この画面の登録案内")).toBeVisible();
    expect(mutationCalls("access.registration")).toHaveLength(1);
    expect(mutationCalls("access.session")).toHaveLength(0);
    expect(mutationCalls("access.registerCustomer")).toHaveLength(0);
  },
);

// Clerkの削除・ログアウトを呼ばず、対象サービスの登録だけが変更される境界を検証する。
it.each(["customer", "business", "operator"] as const)(
  "サービスごとの退会" +
    " / " +
    "明示的な確認後に %s だけを退会し、Clerkの削除やログアウトは行わない",
  async (service) => {
    registered.customer = true;
    navigate("/account");
    render(accountPage(service));
    fireEvent.click(
      await screen.findByRole("button", {
        name:
          service === "customer" ? "通販会員を退会する" : `${labels[service]}サービスを退会する`,
      }),
    );
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining(withdrawalConfirmation[service]),
    );
    expect(
      await screen.findByText(
        service === "customer"
          ? "通販会員を退会しました。ログインアカウントと他のサービスの登録は残ります。"
          : `${labels[service]}サービスを退会しました。他のサービスとログインアカウントは引き続き利用できます。`,
      ),
    ).toBeVisible();
    expect(mutationCalls("access.withdraw")).toHaveLength(1);
    const body = mutationCalls("access.withdraw")[0]?.[1]?.body;
    if (typeof body !== "string") {
      throw new Error("Expected a JSON withdrawal request body");
    }

    expect(JSON.parse(body)).toEqual({
      "0": { service: service },
    });
    expect(clients.get(service)?.getQueryData(["private-orders"])).toBeUndefined();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(registered[service]).toBe(false);
    for (const other of ["customer", "business", "operator"] as const) {
      if (other !== service) {
        expect(registered[other]).toBe(true);
      }
    }

    expect(screen.queryByRole("link", { name: "会員登録へ進む" })).not.toBeInTheDocument();
    if (service !== "customer") {
      expect(screen.getByText(/招待リンクから登録してください/)).toBeVisible();
    }
  },
);

it(
  "サービスごとの退会" +
    " / " +
    "退会時に遅延中のセッション取得を取り消し、戻る操作でも以前の会員を復活させない",
  async () => {
    registered.customer = true;
    navigate("/account");
    const view = render(accountPage("customer"));
    await screen.findByRole("button", { name: "通販会員を退会する" });
    const client = clients.get("customer")!;
    const key = [["access", "session"], { input: { service: "customer" }, type: "query" }];
    const oldSession = Promise.withResolvers<unknown>();
    const result = client
      .fetchQuery({ queryKey: key, queryFn: () => oldSession.promise })
      .catch(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "通販会員を退会する" }));
    await screen.findByText(
      "通販会員を退会しました。ログインアカウントと他のサービスの登録は残ります。",
    );
    await act(async () => {
      oldSession.resolve({ userId: "withdrawn-account" });
      await result;
    });
    expect(client.getQueryData(key)).toBeUndefined();
    navigate("/");
    view.rerender(
      <AppProviders service="customer">
        <AuthenticationGate>
          <ServiceQualificationGate service="customer">
            <p>古い会員の業務画面</p>
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    expect(await screen.findByRole("heading", { name: "会員登録が必要です" })).toBeVisible();
    expect(screen.queryByText("古い会員の業務画面")).not.toBeInTheDocument();
  },
);

it(
  "サービスごとの退会" + " / " + "キャンセル時は所属とキャッシュ済みデータをどちらも変更しない",
  async () => {
    registered.customer = true;
    navigate("/account");
    vi.mocked(window.confirm).mockReturnValue(false);
    render(accountPage("customer"));
    fireEvent.click(await screen.findByRole("button", { name: "通販会員を退会する" }));
    expect(mutationCalls("access.withdraw")).toHaveLength(0);
    expect(clients.get("customer")?.getQueryData(["private-orders"])).toEqual([
      "customer-historical-order",
    ]);
    expect(registered.customer).toBe(true);
  },
);

it(
  "サービスごとの退会" +
    " / " +
    "最後のオーナーの退会拒否を表示し、所属を保持して後から再試行できる",
  async () => {
    navigate("/account");
    render(accountPage("business"));
    await screen.findByRole("button", { name: "事業者サービスを退会する" });
    requests.mockResolvedValueOnce(rejection("最後のオーナーは削除できません"));
    fireEvent.click(screen.getByRole("button", { name: "事業者サービスを退会する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "先に同じサービスの会員へ権限を引き継いでください",
    );
    expect(clients.get("business")?.getQueryData(["private-orders"])).toEqual([
      "business-historical-order",
    ]);
    expect(registered.business).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "事業者サービスを退会する" }));
    expect(
      await screen.findByText(
        "事業者サービスを退会しました。他のサービスとログインアカウントは引き続き利用できます。",
      ),
    ).toBeVisible();
  },
);

it("サービスごとの退会" + " / " + "他サービスで使用中のキャッシュを消去しない", async () => {
  registered.customer = true;
  navigate("/account");
  render(
    <>
      {accountPage("customer")}
      {accountPage("business")}
    </>,
  );
  await screen.findByRole("button", { name: "事業者サービスを退会する" });
  fireEvent.click(await screen.findByRole("button", { name: "通販会員を退会する" }));
  await screen.findByText(
    "通販会員を退会しました。ログインアカウントと他のサービスの登録は残ります。",
  );
  expect(clients.get("business")?.getQueryData(["private-orders"])).toEqual([
    "business-historical-order",
  ]);
  expect(screen.getByRole("button", { name: "事業者サービスを退会する" })).toBeVisible();
});

it(
  "サービスごとの退会" +
    " / " +
    "重複した退会を防ぎ、再マウントや戻る操作の後も退会済みの状態を維持する",
  async () => {
    registered.customer = true;
    navigate("/account");
    const view = render(accountPage("customer"));
    await screen.findByRole("button", { name: "通販会員を退会する" });
    const pending = Promise.withResolvers<Response>();
    requests.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "通販会員を退会する" }));
    await waitFor(() => expect(mutationCalls("access.withdraw")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "処理中…" }));
    expect(mutationCalls("access.withdraw")).toHaveLength(1);
    registered.customer = false;
    await act(async () => pending.resolve(success({ category: "customer" })));
    await screen.findByRole("heading", { name: "会員登録が必要です" });
    view.unmount();
    render(accountPage("customer"));
    expect(await screen.findByRole("heading", { name: "会員登録が必要です" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "通販会員を退会する" })).not.toBeInTheDocument();
    expect(mutationCalls("access.withdraw")).toHaveLength(1);
  },
);

const withdrawalConfirmation = {
  customer: "過去の注文履歴は保持されます",
  business: "過去の注文・監査履歴は保持されます",
  operator: "過去の注文・監査履歴は保持されます",
} as const;
