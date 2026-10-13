import {
  render,
  fetchSession,
  fetchRegistration,
  qualified,
  forbidden,
  navigate,
  app,
  expectProtectedAbsent,
  requestUrl,
  requestHeaders,
} from "#client/test/access-qualification/fixture";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vite-plus/test";
import { QUERY_POLICY } from "#client/_app/providers/query-policy";

import { mocks } from "#client/test/access-qualification/mocks";

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "アクセス不可の企業へ移動しても許可済みの企業のキャッシュ済みセッションを再利用しない",
  async () => {
    navigate("/organizations/tenant-a");
    const view = render(app("business", "tenant-a"));
    await screen.findByRole("heading", { name: "保護された画面" });
    expect(requestHeaders().get("x-organization-id")).toBe("tenant-a");
    const pending = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(pending.promise);
    navigate("/organizations/tenant-b/products");
    view.rerender(app("business", "tenant-b"));
    expectProtectedAbsent();
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(2));
    expect(requestHeaders(1).get("x-organization-id")).toBe("tenant-b");
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
    expect(mocks.unmountProtected).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(forbidden()));
    expect(await screen.findByRole("alert")).toBeVisible();
    expectProtectedAbsent();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "現在のルートが拒否された後に以前のルートの利用資格確認が成功しても無視する",
  async () => {
    navigate("/organizations/tenant-a");
    const previous = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(previous.promise).mockImplementation(async () => forbidden());
    const view = render(app("business", "tenant-a"));
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(1));
    navigate("/organizations/tenant-b");
    view.rerender(app("business", "tenant-b"));
    expect(await screen.findByRole("alert")).toBeVisible();
    await act(async () => previous.resolve(qualified()));
    expectProtectedAbsent();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
    expect(mocks.mountProtected).not.toHaveBeenCalled();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "トークン取得が遅れても開始時のルートの企業との対応を維持する",
  async () => {
    navigate("/organizations/tenant-a");
    const token = Promise.withResolvers<string | null>();
    mocks.auth.getToken.mockReturnValueOnce(token.promise);
    const view = render(app("business", "tenant-a"));
    await waitFor(() => expect(mocks.auth.getToken).toHaveBeenCalledTimes(1));
    navigate("/organizations/tenant-b");
    view.rerender(app("business", "tenant-b"));
    await screen.findByRole("heading", { name: "保護された画面" });
    expect(requestHeaders().get("x-organization-id")).toBe("tenant-b");
    await act(async () => token.resolve("previous-token"));
    // 離脱済みの登録要求の送信が完了しても、旧スコープのセッション取得へは進ませない。
    expect(fetchSession).toHaveBeenCalledTimes(1);
    const previousRegistration = fetchRegistration.mock.calls.find((props) => {
      const [, init] = props;
      return new Headers(init?.headers).get("authorization") === "Bearer previous-token";
    });
    expect(new Headers(previousRegistration?.[1]?.headers).get("x-organization-id")).toBe(
      "tenant-a",
    );
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "同じ企業内のページ移動と戻る操作では利用資格とセッションを再利用する",
  async () => {
    navigate("/organizations/tenant-a");
    const view = render(app("business", "tenant-a"));
    await screen.findByRole("heading", { name: "保護された画面" });
    navigate("/organizations/tenant-a/products");
    view.rerender(app("business", "tenant-a"));
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    navigate("/organizations/tenant-a/members");
    view.rerender(app("business", "tenant-a"));
    navigate("/organizations/tenant-a");
    view.rerender(app("business", "tenant-a"));
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(fetchRegistration).toHaveBeenCalledTimes(1);
    expect(fetchSession).toHaveBeenCalledTimes(1);
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
    expect(mocks.unmountProtected).not.toHaveBeenCalled();
  },
);

it(
  "アプリ入口の利用資格確認" + " / " + "開いたままのページをセッションの有効期間内に再検証する",
  async () => {
    vi.useFakeTimers();
    render(app());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(fetchSession).toHaveBeenCalledTimes(1);
    fetchSession.mockImplementation(async () => forbidden());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUERY_POLICY.sessionRefreshIntervalMs - 200);
    });
    expect(fetchSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toBeVisible();
    expectProtectedAbsent();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "オフライン中もキャッシュ済み権限を期限切れにし、再接続後の検証に成功してからページを復元する",
  async () => {
    vi.useFakeTimers();
    render(app());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    await act(async () => {
      onlineManager.setOnline(false);
      await vi.advanceTimersByTimeAsync(QUERY_POLICY.sessionMaxAgeMs);
    });
    expectProtectedAbsent();
    expect(screen.getByRole("status")).toHaveTextContent("利用資格を確認しています");
    expect(fetchSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(fetchSession).toHaveBeenCalledTimes(2);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "再検証の要求が応答待ちのままでも期限切れの権限に基づく表示を残さない",
  async () => {
    vi.useFakeTimers();
    render(app());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    const pending = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(pending.promise);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUERY_POLICY.sessionRefreshIntervalMs);
    });
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUERY_POLICY.sessionMaxAgeMs);
    });
    expectProtectedAbsent();
    expect(screen.getByRole("status")).toHaveTextContent("利用資格を確認しています");
    await act(async () => {
      pending.resolve(qualified());
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "期限切れのまま応答しない要求を置き換え、遅れて届く成功結果で表示を復活させない",
  async () => {
    vi.useFakeTimers();
    render(app());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    const hung = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(hung.promise);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUERY_POLICY.sessionMaxAgeMs + 100);
    });
    expectProtectedAbsent();
    fetchSession.mockImplementation(async () => forbidden());
    fireEvent.click(screen.getByRole("button", { name: "もう一度確認" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole("alert")).toBeVisible();
    await act(async () => {
      hung.resolve(qualified());
      await vi.advanceTimersByTimeAsync(100);
    });
    expectProtectedAbsent();
    expect(screen.getByRole("alert")).toBeVisible();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "明示されたサービスやログイン中の本人が変わったらセッションを分離する",
  async () => {
    const view = render(app());
    await screen.findByRole("heading", { name: "保護された画面" });
    fetchSession.mockImplementation(async () => forbidden());
    view.rerender(app("operator"));
    expectProtectedAbsent();
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(requestUrl(1)).toMatch("/api/trpc/access.session?");
    expect(
      JSON.parse(new URL(requestUrl(1)!, window.location.origin).searchParams.get("input") ?? "{}"),
    ).toEqual({ "0": { service: "operator" } });
    mocks.auth.userId = "unqualified-user";
    view.rerender(app());
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(fetchSession).toHaveBeenCalledTimes(3);
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "フォーカス時の再検証中は現在のルートのフォーム状態を保持し、権限が失われたら破棄する",
  async () => {
    render(app());
    await screen.findByRole("heading", { name: "保護された画面" });
    const pending = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(pending.promise);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(mocks.unmountProtected).not.toHaveBeenCalled();
    await act(async () => pending.resolve(forbidden()));
    expect(await screen.findByRole("alert")).toBeVisible();
    expectProtectedAbsent();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "確認済みのルートをオフライン中も維持し、再接続時に拒否されたら表示を除く",
  async () => {
    render(app());
    await screen.findByRole("heading", { name: "保護された画面" });
    fetchSession.mockImplementation(async () => forbidden());
    await act(async () => {
      onlineManager.setOnline(false);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(fetchSession).toHaveBeenCalledTimes(1);
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByRole("alert")).toBeVisible();
    expectProtectedAbsent();
    expect(fetchSession).toHaveBeenCalledTimes(2);
  },
);
