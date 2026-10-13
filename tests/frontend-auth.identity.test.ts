// @vitest-environment node
import { expect, it, vi } from "vite-plus/test";
import {
  authenticateRequest,
  createClerkClient,
  ORIGIN,
  ISSUER,
  PUBLISHABLE_KEY,
  SECRET_KEY,
  options,
  documentRequest,
  signedIn,
  signedOut,
  expectPrivate,
  expectContinue,
  expectBlocked,
} from "@/tests/frontend-auth-fixture.ts";
import { synchronizeFrontendSession } from "@dev-template/config/auth";

it("Clerkによるリクエスト検証と本人情報の照合 / 認証情報をClerkへ渡し、偽装した転送ヘッダーを除去して受け付けるトークンを限定する", async () => {
  authenticateRequest.mockResolvedValue(signedIn());
  const response = await synchronizeFrontendSession(
    documentRequest("/account", {
      headers: {
        cookie: "__session=opaque-signed-session",
        authorization: "Bearer opaque-session",
        host: "evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "http",
        "cloudfront-forwarded-proto": "http",
      },
    }),
    options(),
  );
  expectContinue(response);
  expectPrivate(response);
  expect(createClerkClient).toHaveBeenCalledWith({
    secretKey: SECRET_KEY,
    publishableKey: PUBLISHABLE_KEY,
  });
  const [request, configuration] = authenticateRequest.mock.calls[0]!;
  expect(request.url).toBe(`${ORIGIN}/account`);
  expect(request.headers.get("cookie")).toBe("__session=opaque-signed-session");
  expect(request.headers.get("authorization")).toBe("Bearer opaque-session");
  for (const header of [
    "host",
    "x-forwarded-host",
    "x-forwarded-proto",
    "cloudfront-forwarded-proto",
  ]) {
    expect(request.headers.has(header)).toBe(false);
  }

  expect(configuration).toEqual({ acceptsToken: "session_token", authorizedParties: [ORIGIN] });
});

it("Clerkによるリクエスト検証と本人情報の照合 / 転送ヘッダーが偽装されても、未許可のリクエスト元をClerk呼び出し前に拒否する", async () => {
  expectBlocked(
    await synchronizeFrontendSession(
      new Request("https://evil.example/account", {
        headers: { "x-forwarded-host": "web.example.com", "x-forwarded-proto": "https" },
      }),
      options(),
    ),
    403,
  );
  expect(authenticateRequest).not.toHaveBeenCalled();
});

it.each([
  { iss: "https://other.clerk.example.com", azp: ORIGIN },
  { iss: `${ISSUER}/`, azp: ORIGIN },
  { iss: ISSUER, azp: "https://evil.example" },
  { iss: ISSUER, azp: "" },
  { iss: ISSUER, azp: undefined },
])(
  "Clerkによるリクエスト検証と本人情報の照合 / SDK検証済みでもissuerやazpが設定と一致しないクレームは拒否する: %j",
  async (sessionClaims) => {
    const state = signedIn();
    authenticateRequest.mockResolvedValue({
      ...state,
      toAuth: () => ({ ...state.toAuth(), sessionClaims }),
    });
    expectBlocked(
      await synchronizeFrontendSession(new Request(`${ORIGIN}/account`), options()),
      503,
    );
  },
);

it.each(["userId", "sessionId"])(
  "Clerkによるリクエスト検証と本人情報の照合 / 検証済みの%sを必須とする",
  async (field) => {
    const state = signedIn();
    authenticateRequest.mockResolvedValue({
      ...state,
      toAuth: () => ({ ...state.toAuth(), [field]: null }),
    });
    expectBlocked(
      await synchronizeFrontendSession(new Request(`${ORIGIN}/account`), options()),
      503,
    );
  },
);

it("Clerkによるリクエスト検証と本人情報の照合 / SDKが認証済みでも検証済みの本人情報がなければ拒否する", async () => {
  authenticateRequest.mockResolvedValue({ ...signedIn(), toAuth: () => null });
  expectBlocked(await synchronizeFrontendSession(new Request(`${ORIGIN}/account`), options()), 503);
});

it("Clerkによるリクエスト検証と本人情報の照合 / 公開ログイン画面で多要素認証を完了できるよう、検証済みの保留中セッションを同期する", async () => {
  const auth = signedIn().toAuth();
  const toAuth = vi.fn((configuration?: { treatPendingAsSignedOut: boolean }) => {
    if (configuration?.treatPendingAsSignedOut !== false) {
      return null;
    }

    return { ...auth, sessionClaims: { ...auth.sessionClaims, sts: "pending" } };
  });
  authenticateRequest.mockResolvedValue({ ...signedIn(), toAuth });
  const response = await synchronizeFrontendSession(
    documentRequest("/sign-in/factor-two"),
    options(),
  );
  expectContinue(response);
  expectPrivate(response);
  expect(toAuth).toHaveBeenLastCalledWith({ treatPendingAsSignedOut: false });
  expect(response.headers.get("Location")).toBeNull();
});

it("Clerkによるリクエスト検証と本人情報の照合 / 偽Cookieやデモ用ヘッダーもClerkに判定を任せ、本人情報の付与や転送を行わない", async () => {
  const state = signedOut();
  authenticateRequest.mockResolvedValue(state);
  expectContinue(
    await synchronizeFrontendSession(
      new Request(`${ORIGIN}/account`, {
        headers: {
          cookie: "__session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyX2ZpeHR1cmUifQ.",
          "x-demo-user": "user_fixture",
          "x-demo-role": "admin",
        },
      }),
      options(),
    ),
  );
  expect(authenticateRequest).toHaveBeenCalledOnce();
  expect(state.toAuth).not.toHaveBeenCalled();
});

it("Clerkによるリクエスト検証と本人情報の照合 / 認証プロバイダーのエラー時は秘密情報を漏らさず拒否する", async () => {
  authenticateRequest.mockRejectedValue(new Error(`provider detail ${SECRET_KEY}`));
  const response = await synchronizeFrontendSession(documentRequest("/account"), options());
  expectBlocked(response, 503);
  expect(await response.text()).not.toContain(SECRET_KEY);
  expect(response.headers.get("Location")).toBeNull();
});
