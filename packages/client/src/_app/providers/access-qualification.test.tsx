import {
  render,
  fetchSession,
  fetchRegistration,
  services,
  qualified,
  forbidden,
  navigate,
  app,
  expectProtectedAbsent,
  requestUrl,
  requestHeaders,
} from "#client/test/access-qualification/fixture";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { expect, it, vi } from "vite-plus/test";
import { AuthenticationGate, ServiceQualificationGate } from "#client/_app/guards";
import { AppProviders } from "#client/_app/providers/app-providers";
import { OrganizationPicker } from "#client/widgets/access-console";

import { mocks } from "#client/test/access-qualification/mocks";

it.each(services)(
  "アプリ入口の利用資格確認" +
    " / " +
    "保護されたセッションの取得や会員の作成をせず、%s が未登録であることを表示する",
  async (service) => {
    const category = service;
    fetchRegistration.mockResolvedValue(
      Response.json([{ result: { data: { registered: false, category, accountId: null } } }]),
    );
    render(app(service));
    expect(
      await screen.findByRole("heading", {
        name: service === "customer" ? "会員登録が必要です" : /サービスは未登録です/,
      }),
    ).toBeVisible();
    expectProtectedAbsent();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
    expect(fetchSession).not.toHaveBeenCalled();
    expect(fetchRegistration).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "会員登録へ進む" })).not.toBeInTheDocument();
  },
);

it(
  "アプリ入口の利用資格確認" + " / " + "登録状態の取得エラーとサービス未登録を区別する",
  async () => {
    fetchRegistration.mockRejectedValueOnce(new TypeError("network unavailable"));
    render(app("customer"));
    expect(
      await screen.findByRole("heading", { name: "利用資格を確認できませんでした" }),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "会員登録へ進む" })).not.toBeInTheDocument();
    expect(fetchSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "もう一度確認" }));
    expect(await screen.findByRole("heading", { name: "保護された画面" })).toBeVisible();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "プロバイダーのコンテキストやpathnameが別のサービスを示しても明示されたサービスを使う",
  async () => {
    navigate("/register");
    render(
      <AppProviders service="customer">
        <AuthenticationGate>
          <ServiceQualificationGate service="business">
            <p>明示されたサービスの画面</p>
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    expect(await screen.findByText("明示されたサービスの画面")).toBeVisible();
    expect(
      JSON.parse(new URL(requestUrl()!, window.location.origin).searchParams.get("input") ?? "{}"),
    ).toEqual({ "0": { service: "business" } });
  },
);

it(
  "アプリ入口の利用資格確認" + " / " + "企業に所属していない登録済みの顧客も利用できる",
  async () => {
    render(
      <AppProviders service="customer">
        <AuthenticationGate>
          <ServiceQualificationGate service="customer">
            <OrganizationPicker />
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    expect(await screen.findByRole("heading", { name: "商品一覧" })).toBeVisible();
    expect(screen.getByText("企業への所属や招待なしで商品を購入できます。")).toBeVisible();
    expect(screen.getByRole("link", { name: "登録情報・退会" })).toHaveAttribute(
      "href",
      "/account",
    );
  },
);

it.each(services)(
  "アプリ入口の利用資格確認" +
    " / " +
    "ログイン済みでも %s の利用対象でなければ画面の共通枠を描画する前に拒否する",
  async (service) => {
    fetchSession.mockImplementation(async () => forbidden());
    render(app(service));
    expect(
      await screen.findByRole("heading", { name: "この画面を利用する権限がありません" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("管理者に確認してください");
    expectProtectedAbsent();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
    expect(mocks.mountProtected).not.toHaveBeenCalled();
    expect(fetchSession).toHaveBeenCalledTimes(1);
    expect(requestUrl()).toMatch("/api/trpc/access.session?");
    expect(
      JSON.parse(new URL(requestUrl()!, window.location.origin).searchParams.get("input") ?? "{}"),
    ).toEqual({ "0": { service } });
    expect(requestHeaders().get("authorization")).toBe("Bearer test-token");
    expect(requestHeaders().has("x-organization-id")).toBe(false);
  },
);

it.each(services)(
  "アプリ入口の利用資格確認" +
    " / " +
    "操作権限や選択企業がなくても利用資格のある %s 会員を受け入れる",
  async (service) => {
    render(app(service));
    expect(await screen.findByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(screen.getByText("操作権限数：0")).toBeVisible();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
    expect(fetchSession).toHaveBeenCalledTimes(1);
    expect(requestHeaders().has("x-organization-id")).toBe(false);
  },
);

it(
  "アプリ入口の利用資格確認" + " / " + "企業が未選択でも利用資格のある事業者は入口ページを開ける",
  async () => {
    render(
      <AppProviders service="business">
        <AuthenticationGate>
          <ServiceQualificationGate service="business">
            <OrganizationPicker />
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    expect(await screen.findByRole("heading", { name: "利用する企業を選択" })).toBeVisible();
    expect(
      screen.getByText("所属企業がありません。企業の担当者から招待を受けてください。"),
    ).toBeVisible();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "APIが利用資格を確認するまで保護された子要素を描画もマウントもしない",
  async () => {
    const pending = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(pending.promise);
    render(app());
    expect(await screen.findByRole("status")).toHaveTextContent("利用資格を確認しています");
    expectProtectedAbsent();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
    expect(mocks.mountProtected).not.toHaveBeenCalled();
    await act(async () => pending.resolve(qualified()));
    expect(await screen.findByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "新しいサービス会員の登録情報に以前の会員のセッションを混在させない",
  async () => {
    const pending = Promise.withResolvers<Response>();
    fetchRegistration.mockImplementation(async () =>
      Response.json([
        {
          result: {
            data: { registered: true, category: "business", accountId: "replacement-account" },
          },
        },
      ]),
    );
    fetchSession
      .mockResolvedValueOnce(qualified("previous-account"))
      .mockReturnValueOnce(pending.promise);
    render(app());
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(2));
    expectProtectedAbsent();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("利用資格を確認しています");
    await act(async () => pending.resolve(qualified("replacement-account")));
    expect(await screen.findByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "StrictModeによるエフェクトの再マウントを経ても利用資格を維持する",
  async () => {
    render(<StrictMode>{app()}</StrictMode>);
    expect(await screen.findByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(fetchSession).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" + " / " + "認証情報の読み込み中は利用資格の確認を開始しない",
  async () => {
    mocks.auth.isLoaded = false;
    render(app());
    expect(await screen.findByText("認証情報を確認しています…")).toBeVisible();
    expectProtectedAbsent();
    expect(fetchSession).not.toHaveBeenCalled();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "ログアウト済みの利用者を専用ログイン画面へ転送し、保護されたページへの戻り先を維持する",
  async () => {
    navigate("/organizations/tenant-a/products?view=images");
    mocks.auth.isSignedIn = false;
    mocks.auth.userId = null;
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
    render(app());
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/sign-in?returnTo=%2Forganizations%2Ftenant-a%2Fproducts%3Fview%3Dimages",
      ),
    );
    expectProtectedAbsent();
    expect(fetchSession).not.toHaveBeenCalled();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
  },
);

it.each(services)(
  "アプリ入口の利用資格確認" +
    " / " +
    "ローカルのデモモードでも実際の %s APIによる利用資格確認を行う",
  async (service) => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    fetchSession.mockImplementation(async () => forbidden());
    render(app(service));
    expect(await screen.findByRole("alert")).toHaveTextContent("管理者に確認してください");
    expect(requestUrl()).toMatch("/api/trpc/access.session?");
    expect(
      JSON.parse(new URL(requestUrl()!, window.location.origin).searchParams.get("input") ?? "{}"),
    ).toEqual({ "0": { service } });
    expect(requestHeaders().has("authorization")).toBe(false);
    expectProtectedAbsent();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "共通プロバイダーに企業が渡されていなければ企業スコープを推測しない",
  async () => {
    navigate("/organizations/tenant-from-url/products");
    render(app());
    await screen.findByRole("heading", { name: "保護された画面" });
    expect(requestHeaders().has("x-organization-id")).toBe(false);
    expect(
      new Headers(fetchRegistration.mock.calls[0]?.[1]?.headers).has("x-organization-id"),
    ).toBe(false);
  },
);
