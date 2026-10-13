// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  authenticateRequest,
  createClerkClient,
  cloudflareEnvironment,
  ORIGIN,
  ISSUER,
  PUBLISHABLE_KEY,
  SECRET_KEY,
  COOKIES,
  documentRequest,
  decisionHeaders,
  signedIn,
  signedOut,
  expectPrivate,
  expectContinue,
  expectBlocked,
} from "@/tests/frontend-auth-fixture.ts";
import * as webProxy from "@/apps/web/src/_app/server/proxy.ts";
import * as businessProxy from "@/apps/business/src/_app/server/proxy.ts";
import * as adminProxy from "@/apps/admin/src/_app/server/proxy.ts";

for (const [mode, app] of [
  ["web", webProxy],
  ["business", businessProxy],
  ["admin", adminProxy],
] as const) {
  describe(`${mode}のアプリ入口とプロキシの接続`, () => {
    beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", PUBLISHABLE_KEY));
    registerAppRoutes(app);
    registerAppInvitations(app);
    registerAppConfiguration(app);
  });
}

function registerAppRoutes(app: typeof webProxy) {
  it("認可用matcherやサービスモード設定を公開しない", () => {
    expect(app).not.toHaveProperty("config");
  });
  it.each([
    "/",
    "/account",
    "/account/settings",
    "/organizations/org.with.dots/orders",
    "/private.json",
    "/api-other",
    "/assets-private",
    "/_next/static-other",
    "/register",
    "/sign-in/factor-two",
  ])("Workerの同期処理で%sに到達し、ログイン可否を判断せずセッションを同期する", async (path) => {
    const response = await app.proxy(documentRequest(path));
    expectContinue(response);
    expectPrivate(response);
    expect(response.headers.get("Location")).toBeNull();
    expect(authenticateRequest).toHaveBeenCalledOnce();
  });
  it.each([
    "/api",
    "/api/trpc/access.session",
    "/api/trpc/product.getImage",
    "/assets/app.js",
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ])("Workerの同期処理で%sに到達し、共通ヘルパーはAPI・アセットの処理に任せる", async (path) => {
    expectContinue(await app.proxy(documentRequest(path)));
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
}

function registerAppInvitations(app: typeof webProxy) {
  it.each(["/invitations/accept", "/invitations/accept/", "/invitations/accept?source=mail"])(
    "%sで外部のClerkハンドシェイクより先に招待を取り込める",
    async (path) => {
      authenticateRequest.mockResolvedValue({
        ...signedOut(decisionHeaders(`${ISSUER}/v1/client/handshake`)),
        status: "handshake",
      });
      const response = await app.proxy(documentRequest(path));
      expectContinue(response);
      expectPrivate(response);
      expect(response.headers.get("Location")).toBeNull();
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(createClerkClient).not.toHaveBeenCalled();
    },
  );
  it("Clerk設定が不足していても招待トークンを取り込める", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", undefined);
    cloudflareEnvironment.CLERK_SECRET_KEY = "";
    const response = await app.proxy(documentRequest("/invitations/accept/"));
    expectContinue(response);
    expectPrivate(response);
    expect(createClerkClient).not.toHaveBeenCalled();
  });
  it.each(["/invitations/accept-other", "/invitations/accept/extra", "/sign-in", "/register"])(
    "%sには招待トークン取り込み用の例外を適用しない",
    async (path) => {
      const location = `${ISSUER}/v1/client/handshake`;
      authenticateRequest.mockResolvedValue({
        ...signedOut(decisionHeaders(location)),
        status: "handshake",
      });
      const response = await app.proxy(documentRequest(path));
      expectBlocked(response, 307);
      expect(response.headers.get("Location")).toBe(location);
      expect(response.headers.getSetCookie()).toEqual(COOKIES);
      expect(authenticateRequest).toHaveBeenCalledOnce();
    },
  );
}

function registerAppConfiguration(app: typeof webProxy) {
  it("実行時のキーと許可済みオリジン設定をSDKに渡す", async () => {
    authenticateRequest.mockResolvedValue(signedIn());
    expectContinue(await app.proxy(documentRequest("/account")));
    expect(createClerkClient).toHaveBeenCalledWith({
      secretKey: SECRET_KEY,
      publishableKey: PUBLISHABLE_KEY,
    });
    expect(authenticateRequest.mock.calls[0]?.[1]).toEqual({
      acceptsToken: "session_token",
      authorizedParties: [ORIGIN],
    });
  });
  it("公開キーが未設定なら拒否する", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", undefined);
    expectBlocked(await app.proxy(documentRequest("/account")), 503);
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
  it("デモ利用をimport.meta.env.DEVの開発環境に限定する", async () => {
    cloudflareEnvironment.APP_ENV = "local";
    cloudflareEnvironment.CLERK_SECRET_KEY = "";
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("DEV", true);
    expectContinue(await app.proxy(new Request("http://localhost:5173/account")));
    vi.stubEnv("DEV", false);
    expectBlocked(await app.proxy(new Request("http://localhost:5173/account")), 503);
  });
}
