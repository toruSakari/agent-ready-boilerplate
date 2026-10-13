// @vitest-environment node
import { expect, it } from "vite-plus/test";
import {
  authenticateRequest,
  ORIGIN,
  ISSUER,
  COOKIES,
  options,
  documentRequest,
  decisionHeaders,
  signedIn,
  signedOut,
  expectPrivate,
  expectContinue,
  expectBlocked,
} from "@/tests/frontend-auth-fixture.ts";
import { synchronizeFrontendSession } from "@dev-template/config/auth";

it("セッション同期とClerkの応答ヘッダー / 未ログインのページ要求に独自のログイン転送やreturnTo方針を適用しない", async () => {
  const response = await synchronizeFrontendSession(
    documentRequest(
      "/orders?filter=open&__clerk_hs=secret&__clerk_synced=true&returnTo=https://evil.example",
    ),
    options(),
  );
  expectContinue(response);
  expectPrivate(response);
  expect(response.headers.get("Location")).toBeNull();
});

it.each<RequestInit>([
  { method: "GET", headers: { "sec-fetch-dest": "document" } },
  { method: "HEAD", headers: { "sec-fetch-dest": "document" } },
  { method: "GET", headers: { "sec-fetch-dest": "iframe" } },
  { method: "HEAD", headers: { accept: "text/html" } },
  { method: "GET", headers: { accept: "text/x-component", rsc: "1" } },
  { method: "GET", headers: { accept: "text/html", "sec-fetch-dest": "empty" } },
  { method: "GET", headers: { accept: "application/json" } },
  { method: "POST", headers: { accept: "text/html" } },
  { method: "GET" },
])(
  "セッション同期とClerkの応答ヘッダー / SDKのLocationがなければ未ログインのページ遷移・取得を続ける: %j",
  async (init) => {
    const response = await synchronizeFrontendSession(
      new Request(`${ORIGIN}/account`, init),
      options(),
    );
    expectContinue(response);
    expectPrivate(response);
    expect(response.headers.get("Location")).toBeNull();
  },
);

it.each<RequestInit>([
  { method: "GET", headers: { "sec-fetch-dest": "document" } },
  { method: "HEAD", headers: { "sec-fetch-dest": "document" } },
  { method: "GET", headers: { "sec-fetch-dest": "iframe" } },
  { method: "HEAD", headers: { accept: "text/html" } },
])(
  "セッション同期とClerkの応答ヘッダー / ページ遷移の場合だけ許可済みのSDKのLocationへ転送する: %j",
  async (init) => {
    const location = `${ISSUER}/v1/client/handshake`;
    authenticateRequest.mockResolvedValue({
      ...signedOut(decisionHeaders(location)),
      status: "handshake",
    });
    const response = await synchronizeFrontendSession(
      new Request(`${ORIGIN}/account`, init),
      options(),
    );
    expectBlocked(response, 307);
    expect(response.headers.get("Location")).toBe(location);
    expect(response.headers.getSetCookie()).toEqual(COOKIES);
  },
);

it.each<RequestInit>([
  { method: "GET", headers: { accept: "text/x-component", rsc: "1" } },
  { method: "GET", headers: { accept: "text/html", "sec-fetch-dest": "empty" } },
  { method: "GET", headers: { accept: "application/json" } },
  { method: "POST", headers: { accept: "text/html" } },
  { method: "GET" },
])(
  "セッション同期とClerkの応答ヘッダー / RSC・fetchなどページ遷移以外でSDKのLocationがある場合は401を返す: %j",
  async (init) => {
    authenticateRequest.mockResolvedValue({
      ...signedOut(decisionHeaders(`${ISSUER}/v1/client/handshake`)),
      status: "handshake",
    });
    const response = await synchronizeFrontendSession(
      new Request(`${ORIGIN}/account`, init),
      options(),
    );
    expectBlocked(response, 401);
    expect(response.headers.get("Location")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual(COOKIES);
  },
);

it.each(["signed-in", "signed-out", "handshake"])(
  "セッション同期とClerkの応答ヘッダー / %s状態で全Cookieと許可済みのLocationを保持する",
  async (status) => {
    const location = `${ISSUER}/v1/client/handshake?redirect_url=${encodeURIComponent(`${ORIGIN}/account`)}`;
    authenticateRequest.mockResolvedValue({ ...signedIn(decisionHeaders(location)), status });
    const response = await synchronizeFrontendSession(documentRequest("/account"), options());
    expectBlocked(response, 307);
    expect(response.headers.get("Location")).toBe(location);
    expect(response.headers.getSetCookie()).toEqual(COOKIES);
  },
);

it.each(["signed-in", "signed-out", "handshake"])(
  "セッション同期とClerkの応答ヘッダー / %s状態のRSC取得ではCookieを保持し、Locationを除去する",
  async (status) => {
    authenticateRequest.mockResolvedValue({
      ...signedIn(decisionHeaders(`${ISSUER}/v1/client/handshake`)),
      status,
    });
    const response = await synchronizeFrontendSession(
      new Request(`${ORIGIN}/account`, { headers: { rsc: "1", accept: "text/x-component" } }),
      options(),
    );
    expectBlocked(response, 401);
    expect(response.headers.get("Location")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual(COOKIES);
  },
);

it("セッション同期とClerkの応答ヘッダー / ログイン済みの複数Cookieを保持し、継続応答を共有キャッシュに保存させない", async () => {
  authenticateRequest.mockResolvedValue(signedIn(decisionHeaders()));
  const response = await synchronizeFrontendSession(documentRequest("/account"), options());
  expectContinue(response);
  expectPrivate(response);
  expect(response.headers.getSetCookie()).toEqual(COOKIES);
});

it("セッション同期とClerkの応答ヘッダー / 未ログインのCookieを保持してルートレイアウトへ処理を続ける", async () => {
  authenticateRequest.mockResolvedValue(signedOut(decisionHeaders()));
  const response = await synchronizeFrontendSession(documentRequest("/account"), options());
  expectContinue(response);
  expectPrivate(response);
  expect(response.headers.get("Location")).toBeNull();
  expect(response.headers.getSetCookie()).toEqual(COOKIES);
});

it.each(["/account?__clerk_hs=1", `${ORIGIN}/account?__clerk_hs=1`])(
  "セッション同期とClerkの応答ヘッダー / 同一オリジンのSDKのLocation %sを許可する",
  async (location) => {
    authenticateRequest.mockResolvedValue({
      ...signedOut(decisionHeaders(location)),
      status: "handshake",
    });
    const response = await synchronizeFrontendSession(documentRequest("/account"), options());
    expectBlocked(response, 307);
    expect(response.headers.get("Location")).toBe(location);
  },
);

it.each([
  "https://evil.example/steal",
  "//evil.example/steal",
  "javascript:alert(1)",
  "http://clerk.example.com/handshake",
])("セッション同期とClerkの応答ヘッダー / 想定外のSDK転送先%sを拒否する", async (location) => {
  authenticateRequest.mockResolvedValue({
    ...signedOut(decisionHeaders(location)),
    status: "handshake",
  });
  const response = await synchronizeFrontendSession(documentRequest("/account"), options());
  expectBlocked(response, 503);
  expect(response.headers.get("Location")).toBeNull();
});

it("セッション同期とClerkの応答ヘッダー / Locationのないハンドシェイクは拒否する", async () => {
  authenticateRequest.mockResolvedValue({ ...signedOut(), status: "handshake" });
  expectBlocked(await synchronizeFrontendSession(documentRequest("/account"), options()), 503);
});
