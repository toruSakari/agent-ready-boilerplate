import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { AppProviders, SignInPage } from "@dev-template/client/providers";
import { CustomerRegistration } from "#web/widgets/customer-registration/index.ts";
import type { Service } from "@dev-template/client/api";
import { QualifiedLayout as CustomerLayout } from "#app/routes/(web)/_authenticated/_qualified/-layout.tsx";
import { AccountPage } from "#app/routes/(web)/_authenticated/account/-page.tsx";

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
  Outlet: () => null,
}));
vi.mock("next-themes", () => ({
  ThemeProvider: (props: { children: ReactNode }) => props.children,
}));
vi.mock("@dev-template/client/theme", () => ({
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
          data: { code: "FORBIDDEN", errorCode: "EMAIL_VERIFICATION_REQUIRED", httpStatus: 403 },
        },
      },
    ],
    { status: 403 },
  );
}

function navigate(path: string) {
  window.history.replaceState(null, "", path);
}

function registrationPage() {
  return (
    <AppProviders service="customer">
      <CustomerRegistration />
    </AppProviders>
  );
}

function mutationCalls(procedure: string) {
  return requests.mock.calls.filter((props) => fetchUrl(props[0]).includes(procedure));
}

async function enterName() {
  fireEvent.change(await screen.findByLabelText("表示名"), { target: { value: "顧客 太郎" } });
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
  // 同じ本人が他サービスへ登録済みでも、通常会員登録を自動作成・削除しない条件を固定する。
  registered = { customer: false, business: true, operator: true };
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

    // 未登録入口から許していない保護APIへの取得が発生したら、その場でテストを失敗させる。
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
    "本人確認のログイン後に自動登録せず、名前を検証して一度だけ送信する",
  async () => {
    render(registrationPage());
    await screen.findByLabelText("表示名");
    expect(mutationCalls("access.registerCustomer")).toHaveLength(0);
    expect(requests).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "会員登録する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("表示名を正しく入力してください");
    expect(mutationCalls("access.registerCustomer")).toHaveLength(0);
    await enterName();
    fireEvent.click(screen.getByRole("button", { name: "会員登録する" }));
    expect(await screen.findByText("会員登録済みです。")).toBeVisible();
    expect(mutationCalls("access.registerCustomer")).toHaveLength(1);
    expect(mutationCalls("access.registerCustomer")[0]?.[1]?.body).toContain("顧客 太郎");
    expect(mutationCalls("access.session")).toHaveLength(0);
    expect(registered).toEqual({ customer: true, business: true, operator: true });
    expect(
      screen.getByText("商品を購入するための会員登録です。企業への所属や招待は必要ありません。"),
    ).toBeVisible();
  },
);

it(
  "利用者の明示的な操作による顧客登録" +
    " / " +
    "ログインの中断や入れ子のログイン画面への移動を経ても登録先への遷移を維持する",
  async () => {
    mocks.auth.isSignedIn = false;
    let view = render(registrationPage());
    const link = await screen.findByRole("link", { name: "ログインして会員登録へ進む" });
    expect(link).toHaveAttribute("href", "/sign-in?returnTo=%2Fregister");
    expect(requests).not.toHaveBeenCalled();
    view.unmount();
    navigate(link.getAttribute("href") ?? "");
    view = render(
      <AppProviders service="customer">
        <SignInPage />
      </AppProviders>,
    );
    await screen.findByText("ログイン確認");
    expect(mocks.signIn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        forceRedirectUrl: "/register",
        signUpForceRedirectUrl: "/register",
      }),
    );
    view.unmount();
    navigate("/sign-in/factor-one");
    view = render(
      <AppProviders service="customer">
        <SignInPage />
      </AppProviders>,
    );
    await screen.findByText("ログイン確認");
    expect(mocks.signIn).toHaveBeenLastCalledWith(
      expect.objectContaining({ forceRedirectUrl: "/register" }),
    );
    view.unmount();
    mocks.auth.isSignedIn = true;
    navigate("/register");
    render(registrationPage());
    expect(await screen.findByLabelText("表示名")).toBeVisible();
    expect(mutationCalls("access.registerCustomer")).toHaveLength(0);
  },
);

it(
  "利用者の明示的な操作による顧客登録" + " / " + "サーバーに拒否されても入力を保持し、再試行できる",
  async () => {
    render(registrationPage());
    await enterName();
    requests.mockResolvedValueOnce(rejection("確認済みのメールアドレスが必要です"));
    fireEvent.click(screen.getByRole("button", { name: "会員登録する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "確認済みのメールアドレスが必要です",
    );
    expect(screen.getByLabelText("表示名")).toHaveValue("顧客 太郎");
    fireEvent.click(screen.getByRole("button", { name: "会員登録する" }));
    expect(await screen.findByText("会員登録済みです。")).toBeVisible();
  },
);

it(
  "利用者の明示的な操作による顧客登録" +
    " / " +
    "送信中の重複登録を防ぎ、再読み込み後も登録を繰り返さない",
  async () => {
    const view = render(registrationPage());
    await enterName();
    const pending = Promise.withResolvers<Response>();
    requests.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "会員登録する" }));
    await waitFor(() => expect(mutationCalls("access.registerCustomer")).toHaveLength(1));
    expect(screen.getByLabelText("表示名")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "処理中…" }));
    expect(mutationCalls("access.registerCustomer")).toHaveLength(1);
    registered.customer = true;
    await act(async () => pending.resolve(success({ accountId: "new-customer" })));
    await screen.findByText("会員登録済みです。");
    view.unmount();
    render(registrationPage());
    expect(await screen.findByText("会員登録済みです。")).toBeVisible();
    expect(mutationCalls("access.registerCustomer")).toHaveLength(1);
  },
);

it.each(["qualified route", "account"] as const)(
  "webアプリが提供する登録案内" +
    " / " +
    "未登録の %s で保護されたデータを取得せずに登録への導線を表示する",
  async (entry) => {
    navigate(entry === "account" ? "/account" : "/");
    render(
      <AppProviders service="customer">
        {entry === "account" ? <AccountPage /> : <CustomerLayout />}
      </AppProviders>,
    );
    expect(await screen.findByRole("heading", { name: "会員登録が必要です" })).toBeVisible();
    expect(
      screen.getByText("会員登録すると、商品を購入できます。企業への所属や招待は必要ありません。"),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "会員登録へ進む" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByText("登録後の顧客画面")).not.toBeInTheDocument();
    expect(mutationCalls("access.registration")).toHaveLength(1);
    expect(mutationCalls("access.session")).toHaveLength(0);
    expect(mutationCalls("access.registerCustomer")).toHaveLength(0);
  },
);

it(
  "webアプリが提供する登録案内" +
    " / " +
    "顧客サービスだけを退会した後にwebの登録への導線を再表示する",
  async () => {
    registered.customer = true;
    navigate("/account");
    render(
      <AppProviders service="customer">
        <AccountPage />
      </AppProviders>,
    );
    await screen.findByRole("button", { name: "通販会員を退会する" });
    expect(screen.queryByRole("link", { name: "会員登録へ進む" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "通販会員を退会する" }));
    expect(await screen.findByRole("link", { name: "会員登録へ進む" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(registered).toEqual({ customer: false, business: true, operator: true });
    expect(mutationCalls("access.withdraw")).toHaveLength(1);
    expect(mutationCalls("access.session")).toHaveLength(0);
    expect(mutationCalls("access.registerCustomer")).toHaveLength(0);
  },
);
