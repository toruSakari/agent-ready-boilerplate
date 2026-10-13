import {
  render,
  fetchSession,
  qualified,
  forbidden,
  navigate,
  app,
  expectProtectedAbsent,
  fetchUrl,
} from "#client/test/access-qualification/fixture";
import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vite-plus/test";
import { AuthenticationGate, ServiceQualificationGate } from "#client/_app/guards";
import { AppProviders } from "#client/_app/providers/app-providers";

import { mocks } from "#client/test/access-qualification/mocks";
import { ProtectedPage } from "#client/test/access-qualification/protected-page";
import { InviteWorkflow } from "#client/test/access-qualification/invite-workflow";
import { AcceptMembership } from "#client/test/access-qualification/accept-membership";
import { DeniedAction } from "#client/test/access-qualification/denied-action";
import { RefreshSession } from "#client/test/access-qualification/refresh-session";

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "アクセス情報の更新に伴うキャッシュ無効化が完了しても発行済みの招待リンクを保持する",
  async () => {
    const invitationToken = "a".repeat(64);
    fetchSession.mockImplementation(async (input) => {
      if (typeof input === "string" && input.includes("access.invite")) {
        return Response.json([
          {
            result: { data: { token: invitationToken, scope: "tenant-a", actorKind: "business" } },
          },
        ]);
      }

      return qualified();
    });
    render(
      <AppProviders service="business">
        <AuthenticationGate>
          <ServiceQualificationGate service="business">
            <InviteWorkflow />
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    await screen.findByRole("heading", { name: "保護された画面" });
    fireEvent.click(screen.getByRole("button", { name: "招待を発行する" }));
    expect(await screen.findByLabelText("発行した招待リンク")).toHaveValue(
      `/invitations/accept#${invitationToken}`,
    );
    expect(fetchSession).toHaveBeenCalledTimes(3);
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
    expect(mocks.unmountProtected).not.toHaveBeenCalled();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "通常のセッション更新でアクセス権限の失効が判明したら画面の共通枠を非表示にする",
  async () => {
    render(
      <AppProviders service="business">
        <AuthenticationGate>
          <ServiceQualificationGate service="business">
            <ProtectedPage />
            <RefreshSession />
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    await screen.findByRole("heading", { name: "保護された画面" });
    fetchSession.mockImplementation(async () => forbidden());
    fireEvent.click(screen.getByRole("button", { name: "所属を再確認" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "この画面を利用する権限がありません" },
        { timeout: 3000 },
      ),
    ).toBeVisible();
    expectProtectedAbsent();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "操作時の403ではフォーム状態を保持して再検証し、サービス入口の拒否としては扱わない",
  async () => {
    fetchSession.mockImplementation(async (input) =>
      fetchUrl(input).includes("access.invite") ? forbidden() : qualified(),
    );
    render(
      <AppProviders service="business">
        <AuthenticationGate>
          <ServiceQualificationGate service="business">
            <ProtectedPage />
            <DeniedAction />
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    await screen.findByRole("heading", { name: "保護された画面" });
    fireEvent.click(screen.getByRole("button", { name: "権限がない操作" }));
    expect(await screen.findByText("操作を拒否しました")).toBeVisible();
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
    expect(mocks.unmountProtected).not.toHaveBeenCalled();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "操作時の403で通信中の古いセッション要求を取り消し、入口の拒否後に遅れて成功しても無視する",
  async () => {
    render(
      <AppProviders service="business">
        <AuthenticationGate>
          <ServiceQualificationGate service="business">
            <ProtectedPage />
            <DeniedAction />
          </ServiceQualificationGate>
        </AuthenticationGate>
      </AppProviders>,
    );
    await screen.findByRole("heading", { name: "保護された画面" });
    const oldSession = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(oldSession.promise);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(2));
    fetchSession.mockImplementation(async () => forbidden());
    fireEvent.click(screen.getByRole("button", { name: "権限がない操作" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expectProtectedAbsent();
    await act(async () => oldSession.resolve(qualified()));
    expectProtectedAbsent();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "招待の承諾後はキャッシュ済みの利用資格と通信中の要求から遅れて届く権限情報を破棄する",
  async () => {
    const view = render(app());
    await screen.findByRole("heading", { name: "保護された画面" });
    const oldSession = Promise.withResolvers<Response>();
    fetchSession.mockReturnValueOnce(oldSession.promise);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(2));
    navigate("/invitations/accept");
    view.rerender(
      <AppProviders service="business">
        <AcceptMembership />
      </AppProviders>,
    );
    fetchSession.mockImplementation(async (input) =>
      fetchUrl(input).includes("access.acceptInvitation")
        ? Response.json([{ result: { data: { scope: "tenant-a" } } }])
        : forbidden(),
    );
    fireEvent.click(await screen.findByRole("button", { name: "所属を取得" }));
    await screen.findByText("所属を取得しました");
    await act(async () => oldSession.resolve(qualified()));
    navigate("/");
    view.rerender(app());
    expectProtectedAbsent();
    expect(await screen.findByRole("alert")).toBeVisible();
    expectProtectedAbsent();
    expect(mocks.mountProtected).toHaveBeenCalledTimes(1);
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "通信エラー時は利用を拒否し、明示的な再試行で成功すれば利用できる",
  async () => {
    fetchSession.mockRejectedValueOnce(new TypeError("network unavailable"));
    render(app());
    expect(
      await screen.findByRole("heading", { name: "利用資格を確認できませんでした" }),
    ).toBeVisible();
    expectProtectedAbsent();
    expect(fetchSession).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "もう一度確認" }));
    expect(await screen.findByRole("heading", { name: "保護された画面" })).toBeVisible();
    expect(fetchSession).toHaveBeenCalledTimes(2);
  },
);

it.each(["/sign-in", "/sign-in/factor-one", "/invitations/accept", "/register", "/ordinary-page"])(
  "アプリ入口の利用資格確認" +
    " / " +
    "子要素に明示的なガードがなければ %s から入口の利用条件を推測しない",
  async (path) => {
    navigate(path);
    mocks.auth.isSignedIn = false;
    mocks.auth.userId = null;
    render(
      <AppProviders service="business">
        <p>公開入口</p>
      </AppProviders>,
    );
    expect(await screen.findByText("公開入口")).toBeVisible();
    expect(fetchSession).not.toHaveBeenCalled();
    expect(mocks.auth.getToken).not.toHaveBeenCalled();
  },
);

it(
  "アプリ入口の利用資格確認" +
    " / " +
    "利用資格のない招待ページの訪問者が通常のページへ移動したら利用資格を再確認する",
  async () => {
    navigate("/invitations/accept");
    fetchSession.mockImplementation(async () => forbidden());
    const view = render(
      <AppProviders service="business">
        <p>公開招待入口</p>
      </AppProviders>,
    );
    expect(await screen.findByText("公開招待入口")).toBeVisible();
    expect(fetchSession).not.toHaveBeenCalled();
    navigate("/");
    view.rerender(app());
    expect(await screen.findByRole("alert")).toBeVisible();
    expectProtectedAbsent();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
    expect(fetchSession).toHaveBeenCalledTimes(1);
  },
);

it.each(["/invitations/accept", "/sign-in", "/account/other", "/register"])(
  "アプリ入口の利用資格確認" +
    " / " +
    "%s でもpathnameによる例外を設けず明示的な利用資格ガードを適用する",
  async (path) => {
    navigate(path);
    fetchSession.mockImplementation(async () => forbidden());
    render(app());
    expect(await screen.findByRole("alert")).toBeVisible();
    expectProtectedAbsent();
    expect(mocks.renderProtected).not.toHaveBeenCalled();
  },
);
