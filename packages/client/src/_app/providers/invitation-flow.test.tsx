import { TestRouter } from "#client/test/router";
import {
  act,
  cleanup,
  fireEvent,
  render as renderReact,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { AppProviders, SignInPage } from "#client/_app/providers/app-providers";
import { AcceptInvitation } from "#client/widgets/access-console";
import {
  INVITATION_PATH,
  INVITATION_STORAGE_KEY,
} from "#client/features/manage-access/model/invitation-session";

const render = (ui: import("react").ReactNode) => renderReact(ui, { wrapper: TestRouter });

const mocks = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: false,
    userId: null as string | null,
    getToken: async () => null,
  },
  accept: vi.fn(),
  clerkHashes: [] as string[],
  signIn: vi.fn(),
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
vi.mock("#client/features/manage-access/api/use-access-mutations", () => ({
  useAccessMutations: () => ({ acceptInvitation: { mutateAsync: mocks.accept } }),
}));
vi.mock("@clerk/react", () => ({
  // 認証SDKが最初に見たURLを記録し、招待の秘密の消去がSDK初期化より先であることを調べる。
  ClerkProvider: (props: { children: ReactNode }) => {
    mocks.clerkHashes.push(window.location.hash);
    return props.children;
  },
  useAuth: () => mocks.auth,
  SignIn: (props: unknown) => {
    mocks.signIn(props);
    return <div>テスト用ログイン画面</div>;
  },
}));

const firstToken = "a".repeat(64);
const secondToken = "b".repeat(64);

// StrictModeのeffect再実行でも招待の保持・世代管理が崩れない組み合わせで試す。
function showInvitation() {
  return render(
    <StrictMode>
      <AppProviders service="business">
        <AcceptInvitation />
      </AppProviders>
    </StrictMode>,
  );
}

function signIn() {
  mocks.auth.isSignedIn = true;
  mocks.auth.userId = "invited-user";
}

function navigate(path: string) {
  window.history.replaceState(null, "", path);
}

async function submit() {
  fireEvent.change(await screen.findByLabelText("表示名"), { target: { value: "招待された本人" } });
  fireEvent.click(screen.getByRole("button", { name: "招待を承諾" }));
  await waitFor(() => expect(mocks.accept).toHaveBeenCalled());
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_invitation");
  window.sessionStorage.clear();
  navigate(`${INVITATION_PATH}#${firstToken}`);
  mocks.auth.isLoaded = true;
  mocks.auth.isSignedIn = false;
  mocks.auth.userId = null;
  mocks.clerkHashes.length = 0;
  mocks.accept.mockReset().mockResolvedValue({ scope: "invited-organization" });
  mocks.signIn.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it(
  "招待の入口と専用ログイン画面" +
    " / " +
    "Clerkのマウント前に招待トークンを保存してURLから除去し、承諾前にログインを案内する",
  async () => {
    mocks.auth.isLoaded = false;
    const view = showInvitation();
    expect(await screen.findByRole("heading", { name: "企業・運営への招待を承諾" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "招待を承諾" })).not.toBeInTheDocument();
    expect(mocks.clerkHashes.every((hash) => hash === "")).toBe(true);
    expect(mocks.clerkHashes.length).toBeGreaterThan(0);
    mocks.auth.isLoaded = true;
    view.rerender(
      <AppProviders service="business">
        <AcceptInvitation />
      </AppProviders>,
    );
    expect(await screen.findByRole("link", { name: "ログインして招待を確認" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Finvitations%2Faccept",
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.accept).not.toHaveBeenCalled();
  },
);

it(
  "招待の入口と専用ログイン画面" +
    " / " +
    "再読み込み、専用ログイン画面への移動、ログインの中断と復帰を経ても招待を保持する",
  async () => {
    let view = showInvitation();
    await screen.findByRole("link", { name: "ログインして招待を確認" });
    view.unmount();
    view = showInvitation();
    const link = await screen.findByRole("link", { name: "ログインして招待を確認" });
    const destination = link.getAttribute("href") ?? "";
    expect(destination).not.toContain(firstToken);
    view.unmount();
    navigate(destination);
    view = render(
      <AppProviders service="business">
        <SignInPage />
      </AppProviders>,
    );
    await screen.findByText("テスト用ログイン画面");
    expect(mocks.signIn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routing: "path",
        path: "/sign-in",
        forceRedirectUrl: INVITATION_PATH,
        signUpForceRedirectUrl: INVITATION_PATH,
      }),
    );
    view.unmount();
    navigate("/sign-in/factor-one");
    view = render(
      <AppProviders service="business">
        <SignInPage />
      </AppProviders>,
    );
    await screen.findByText("テスト用ログイン画面");
    expect(mocks.signIn).toHaveBeenLastCalledWith(
      expect.objectContaining({ forceRedirectUrl: INVITATION_PATH }),
    );
    view.unmount();
    signIn();
    navigate(INVITATION_PATH);
    showInvitation();
    await submit();
    expect(mocks.accept).toHaveBeenCalledWith({
      service: "business",
      token: firstToken,
      name: "招待された本人",
    });
    expect(await screen.findByText("招待を承諾しました。")).toBeVisible();
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
    expect(window.location.hash).toBe("");
  },
);

it(
  "招待の入口と専用ログイン画面" +
    " / " +
    "サーバーに拒否されても未承諾の招待を保持し、再試行できる",
  async () => {
    signIn();
    mocks.accept.mockRejectedValueOnce(
      Object.assign(new Error("private_detail"), {
        data: { code: "BAD_REQUEST", errorCode: "INVITATION_INVALID" },
      }),
    );
    showInvitation();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("招待が無効か期限切れです");
    expect(screen.getByLabelText("表示名")).toHaveValue("招待された本人");
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toContain(firstToken);
    fireEvent.click(screen.getByRole("button", { name: "招待を承諾" }));
    expect(await screen.findByText("招待を承諾しました。")).toBeVisible();
    expect(mocks.accept).toHaveBeenCalledTimes(2);
  },
);

it(
  "招待の入口と専用ログイン画面" +
    " / " +
    "閉じた招待を消去し、再読み込みや履歴移動でも復活させない",
  async () => {
    const view = showInvitation();
    fireEvent.click(await screen.findByRole("button", { name: "招待を閉じる" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("招待リンクが無効か見つかりません");
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("link", { name: "ログインして招待を確認" })).not.toBeInTheDocument();
    view.unmount();
    showInvitation();
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(mocks.accept).not.toHaveBeenCalled();
  },
);

it(
  "招待の入口と専用ログイン画面" + " / " + "使用済みの招待を再読み込み後に復元しない",
  async () => {
    signIn();
    const view = showInvitation();
    await submit();
    await screen.findByText("招待を承諾しました。");
    view.unmount();
    showInvitation();
    expect(await screen.findByRole("alert")).toHaveTextContent("招待リンクが無効か見つかりません");
    expect(mocks.accept).toHaveBeenCalledTimes(1);
  },
);

it("招待の入口と専用ログイン画面" + " / " + "招待を閉じた後に届く完了結果を無視する", async () => {
  signIn();
  const deferred = Promise.withResolvers<{ scope: string }>();
  mocks.accept.mockReturnValueOnce(deferred.promise);
  showInvitation();
  await submit();
  fireEvent.click(screen.getByRole("button", { name: "招待を閉じる" }));
  await act(async () => {
    deferred.resolve({ scope: "closed-organization" });
    await deferred.promise;
  });
  expect(screen.queryByText("招待を承諾しました。")).not.toBeInTheDocument();
  expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("招待リンクが無効か見つかりません");
});

it(
  "招待の入口と専用ログイン画面" + " / " + "2つ目のリンクが不正でも以前の招待を再利用しない",
  async () => {
    showInvitation();
    await screen.findByRole("link", { name: "ログインして招待を確認" });
    act(() => {
      navigate(`${INVITATION_PATH}#malformed`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("招待リンクが無効か見つかりません");
    expect(window.location.hash).toBe("");
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
  },
);

it(
  "招待の入口と専用ログイン画面" +
    " / " +
    "2つ目の招待が届いた後は以前の処理の遅れた完了を無視し、重複送信を防ぐ",
  async () => {
    signIn();
    const deferred = Promise.withResolvers<{ scope: string }>();
    mocks.accept.mockReturnValueOnce(deferred.promise);
    showInvitation();
    await submit();
    expect(screen.getByRole("button", { name: "処理中…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "処理中…" }));
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    act(() => {
      navigate(`${INVITATION_PATH}#${secondToken}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await act(async () => {
      deferred.resolve({ scope: "old-organization" });
      await deferred.promise;
    });
    expect(screen.queryByText("招待を承諾しました。")).not.toBeInTheDocument();
    expect(screen.getByLabelText("表示名")).toHaveValue("");
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toContain(secondToken);
    await submit();
    expect(mocks.accept).toHaveBeenLastCalledWith({
      service: "business",
      token: secondToken,
      name: "招待された本人",
    });
    expect(await screen.findByText("招待を承諾しました。")).toBeVisible();
  },
);

it(
  "招待の入口と専用ログイン画面" +
    " / " +
    "内容の変わらない履歴イベントや同じ招待リンクでは進行中の承諾処理を維持する",
  async () => {
    signIn();
    const deferred = Promise.withResolvers<{ scope: string }>();
    mocks.accept.mockReturnValueOnce(deferred.promise);
    showInvitation();
    await submit();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      navigate(`${INVITATION_PATH}#${firstToken}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("button", { name: "処理中…" })).toBeDisabled();
    expect(screen.getByLabelText("表示名")).toHaveValue("招待された本人");
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    await act(async () => {
      deferred.resolve({ scope: "invited-organization" });
      await deferred.promise;
    });
    expect(await screen.findByText("招待を承諾しました。")).toBeVisible();
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
  },
);

it(
  "招待の入口と専用ログイン画面" + " / " + "新しい不正な招待に以前の成功結果を表示しない",
  async () => {
    signIn();
    showInvitation();
    await submit();
    await screen.findByText("招待を承諾しました。");
    act(() => {
      navigate(`${INVITATION_PATH}#malformed`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText("招待を承諾しました。")).not.toBeInTheDocument();
  },
);

it(
  "招待の入口と専用ログイン画面" +
    " / " +
    "トークンなしで認証を開始せず、復旧可能な保存エラーを表示する",
  async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    showInvitation();
    expect(await screen.findByRole("alert")).toHaveTextContent("招待を一時保存できません");
    expect(window.location.hash).toBe("");
    expect(screen.queryByRole("link", { name: "ログインして招待を確認" })).not.toBeInTheDocument();
    expect(mocks.accept).not.toHaveBeenCalled();
  },
);
