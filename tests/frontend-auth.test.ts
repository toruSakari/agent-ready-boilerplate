// @vitest-environment node
import { expect, it } from "vite-plus/test";
import {
  authenticateRequest,
  createClerkClient,
  options,
  documentRequest,
  expectPrivate,
  expectContinue,
  expectBlocked,
} from "@/tests/frontend-auth-fixture.ts";
import { synchronizeFrontendSession } from "@dev-template/config/auth";

it.each([
  "/sign-in",
  "/sign-in/",
  "/sign-in/factor-one",
  "/register",
  "/register/extra",
  "/invitations/accept",
  "/",
  "/account",
  "/orders",
  "/products",
  "/organizations/org_fixture/members",
  "/sign-in-other",
  "/register-other",
  "/invitations/accept-other",
  "/invitations/accept/extra",
  "/api-other",
  "/assets-private",
  "/_next/static-other",
  "/_next/image-other",
  "/favicon.ico/private",
  "/private.js",
  "/private.css",
  "/src/private.ts",
  "/@vite/client",
])(
  "ルートに依存しないセッション同期 / %sのページ利用可否を判断せず、未ログイン状態を同期する",
  async (path) => {
    const response = await synchronizeFrontendSession(documentRequest(path), options());
    expectContinue(response);
    expectPrivate(response);
    expect(response.headers.get("Location")).toBeNull();
    expect(authenticateRequest).toHaveBeenCalledOnce();
  },
);

it.each([
  "/api",
  "/api/health",
  "/api/trpc/access.session",
  "/api/trpc/product.getImage",
  "/assets/app.js",
  "/_next/static/chunk.js",
  "/_next/image?url=x",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
])(
  "ルートに依存しないセッション同期 / %sの処理を既存のAPI・アセットハンドラーに任せる",
  async (path) => {
    expectContinue(
      await synchronizeFrontendSession(
        documentRequest(path),
        options({
          environment: {},
          publishableKey: undefined,
        }),
      ),
    );
    expect(createClerkClient).not.toHaveBeenCalled();
  },
);

it.each(["/sign-in", "/sign-in/factor-one", "/register", "/invitations/accept"])(
  "ルートに依存しないセッション同期 / 共通ヘルパーは公開パス%sでも設定検証を省略しない",
  async (path) => {
    expectBlocked(
      await synchronizeFrontendSession(
        documentRequest(path),
        options({
          environment: {},
          publishableKey: undefined,
        }),
      ),
      503,
    );
    expect(createClerkClient).not.toHaveBeenCalled();
  },
);
