// @vitest-environment node
import { createClerkClient } from "@clerk/backend";
import { generateKeyPairSync, sign } from "node:crypto";
import type { KeyObject, webcrypto } from "node:crypto";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import { synchronizeFrontendSession } from "@dev-template/config/auth";
import type { FrontendSessionOptions } from "@dev-template/config/auth";

const ORIGIN = "https://web.example.com";
const ISSUER = "https://clerk.example.com";
const KEY_ID = "frontend-auth-integration-rsa";
const TOKEN_LIFETIME_SECONDS = 60;
const EXPIRED_SECONDS = 60;
const PUBLISHABLE_KEY = `pk_live_${Buffer.from("clerk.example.com$").toString("base64")}`;
let trustedPrivateKey: KeyObject;
let untrustedPrivateKey: KeyObject;
let publicJwk: webcrypto.JsonWebKey;
let configuration: FrontendSessionOptions;
let fixtureNumber = 0;
const requests: string[] = [];

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: ISSUER,
    azp: ORIGIN,
    sub: "user_integration",
    sid: "sess_integration",
    iat: now,
    nbf: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
    v: 2,
    sts: "active",
    ...overrides,
  };
}

function token(overrides: Record<string, unknown> = {}, key = trustedPrivateKey) {
  const content = `${encode({ alg: "RS256", typ: "JWT", kid: KEY_ID })}.${encode(claims(overrides))}`;
  return `${content}.${sign("RSA-SHA256", Buffer.from(content), key).toString("base64url")}`;
}

function requestWithToken(
  value: string,
  transport: "cookie" | "bearer" = "bearer",
  document = false,
) {
  const headers = new Headers({ accept: document ? "text/html" : "text/x-component" });
  if (transport === "cookie") {
    headers.set("cookie", `__session=${value}; __client_uat=${Math.floor(Date.now() / 1000) - 1}`);
  } else {
    headers.set("authorization", `Bearer ${value}`);
  }

  if (document) {
    headers.set("sec-fetch-dest", "document");
  }

  return new Request(`${ORIGIN}/account`, { headers });
}

function expectBlocked(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("x-frontend-continue")).toBeNull();
  expect(response.headers.get("Location")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
}

function expectContinue(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("x-frontend-continue")).toBe("1");
  expect(response.headers.get("Location")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
}

async function expectSdkSignedOutContinuation(request: Request) {
  // SDKによる未認証判定を先に確認し、セッション同期の継続を認証成功と取り違えない。
  const state = await createClerkClient({
    secretKey: configuration.environment.CLERK_SECRET_KEY,
    publishableKey: configuration.publishableKey,
  }).authenticateRequest(request, { acceptsToken: "session_token", authorizedParties: [ORIGIN] });
  expect(state.status).toBe("signed-out");
  expect(state.isAuthenticated).toBe(false);
  expect(state.headers.get("Location")).toBeNull();
  expectContinue(await synchronizeFrontendSession(request, configuration));
}

beforeAll(() => {
  const trusted = generateKeyPairSync("rsa", { modulusLength: 2048 });
  trustedPrivateKey = trusted.privateKey;
  publicJwk = trusted.publicKey.export({ format: "jwk" });
  untrustedPrivateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
});
beforeEach(() => {
  fixtureNumber += 1;
  requests.length = 0;
  configuration = {
    development: false,
    publishableKey: PUBLISHABLE_KEY,
    environment: {
      APP_ENV: "production",
      // 実資格情報は使わず、ケースごとに架空のinstance名を変えてSDKの鍵キャッシュを分離する。
      CLERK_SECRET_KEY: `sk_live_frontend_integration_fixture_${fixtureNumber}`,
      CLERK_AUTHORIZED_PARTIES: ORIGIN,
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      requests.push(url);
      if (url !== "https://api.clerk.com/v1/jwks") {
        throw new Error(`Unexpected test network request: ${url}`);
      }

      return Response.json({ keys: [{ ...publicJwk, kid: KEY_ID, alg: "RS256", use: "sig" }] });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

it.each(["cookie", "bearer"] as const)(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 署名検証済みの%sセッションを同期する",
  async (transport) => {
    const response = await synchronizeFrontendSession(
      requestWithToken(token(), transport, true),
      configuration,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-frontend-continue")).toBe("1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(requests).toEqual(["https://api.clerk.com/v1/jwks"]);
  },
);

it.each(["cookie", "bearer"] as const)(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 信頼できない%sの署名はSDKの未ログイン状態のまま処理を続ける",
  async (transport) => {
    await expectSdkSignedOutContinuation(
      requestWithToken(token({}, untrustedPrivateKey), transport),
    );
    expect(requests).toEqual(["https://api.clerk.com/v1/jwks"]);
  },
);

it("ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 署名後に改ざんしたペイロードはSDKの未ログイン状態のまま処理を続ける", async () => {
  const parts = token().split(".");
  parts[1] = encode(claims({ sub: "user_forged", sid: "sess_forged" }));
  await expectSdkSignedOutContinuation(requestWithToken(parts.join(".")));
});

it.each(["cookie", "bearer"] as const)(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 署名のないalg=noneの%sトークンはSDKの未ログイン状態のまま処理を続ける",
  async (transport) => {
    const unsigned = `${encode({ alg: "none", typ: "JWT", kid: KEY_ID })}.${encode(claims())}.`;
    await expectSdkSignedOutContinuation(requestWithToken(unsigned, transport));
  },
);

it.each(["cookie", "bearer"] as const)(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 形式が不正な%sセッションはSDKの未ログイン状態のまま処理を続ける",
  async (transport) => {
    await expectSdkSignedOutContinuation(requestWithToken("not.a.valid-session", transport));
  },
);

it.each([
  { label: "許可されていないオリジン", overrides: { azp: "https://evil.example" } },
  { label: "azp未設定", overrides: { azp: undefined } },
  { label: "sub未設定", overrides: { sub: undefined } },
])(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 署名が正しくてもクレームが不正ならSDKの未ログイン状態のまま処理を続ける: $label",
  async (props) => {
    await expectSdkSignedOutContinuation(requestWithToken(token(props.overrides)));
  },
);

it.each([
  { label: "issuer不一致", overrides: { iss: "https://other-clerk.example.com" } },
  { label: "sid未設定", overrides: { sid: undefined } },
])(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 検証済みクレームが設定済みインスタンスや本人と結び付かない場合は拒否する: $label",
  async (props) => {
    expectBlocked(
      await synchronizeFrontendSession(requestWithToken(token(props.overrides)), configuration),
      503,
    );
  },
);

it.each(["cookie", "bearer"] as const)(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 多要素認証を完了できるよう署名検証済みの保留中%sセッションを同期する",
  async (transport) => {
    expectContinue(
      await synchronizeFrontendSession(
        requestWithToken(token({ sts: "pending" }), transport, true),
        configuration,
      ),
    );
    expect(requests).toEqual(["https://api.clerk.com/v1/jwks"]);
  },
);

it("ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 期限切れのBearerトークンはSDKの未ログイン状態のまま処理を続ける", async () => {
  const exp = Math.floor(Date.now() / 1000) - EXPIRED_SECONDS;
  await expectSdkSignedOutContinuation(requestWithToken(token({ exp })));
});

it("ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / ページ遷移では期限切れCookieに対する実SDKのハンドシェイクを維持する", async () => {
  const exp = Math.floor(Date.now() / 1000) - EXPIRED_SECONDS;
  const response = await synchronizeFrontendSession(
    requestWithToken(token({ exp }), "cookie", true),
    configuration,
  );
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get("Location")!).origin).toBe(ISSUER);
  expect(response.headers.get("x-frontend-continue")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

it("ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 期限切れCookieのRSC取得で実SDKがLocationなしの未ログイン状態を返したら処理を続ける", async () => {
  const exp = Math.floor(Date.now() / 1000) - EXPIRED_SECONDS;
  await expectSdkSignedOutContinuation(requestWithToken(token({ exp }), "cookie"));
});

it.each(["production", "development"] as const)(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 実SDKの%s用nonceハンドシェイクを処理し、新しいセッションの検証と全Cookieの保持を行う",
  async (instanceType) => {
    const nonce = "frontend-auth-handshake-fixture";
    const handshakeUrl = `https://api.clerk.com/v1/clients/handshake_payload?nonce=${nonce}`;
    const refreshedSession = token();
    const directives = [
      `__session=${refreshedSession}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      `__client_uat=${Math.floor(Date.now() / 1000) - 1}; Path=/; Secure; SameSite=Lax`,
      "__clerk_handshake_nonce=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure",
    ];
    if (instanceType === "development") {
      configuration.publishableKey = `pk_test_${Buffer.from("clerk.example.com$").toString("base64")}`;
    }

    // JWKS側の差し替えも維持し、handshakeと鍵取得のどちらも外部へ送信しない。
    const fetchJwks = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== handshakeUrl) {
          return fetchJwks(input, init);
        }

        requests.push(url);
        expect(init?.method).toBe("GET");
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          `Bearer ${configuration.environment.CLERK_SECRET_KEY}`,
        );
        return Response.json({ directives });
      }),
    );

    const response = await synchronizeFrontendSession(
      new Request(`${ORIGIN}/account?tab=profile&__clerk_handshake_nonce=${nonce}`, {
        headers: { accept: "text/html", "sec-fetch-dest": "document" },
      }),
      configuration,
    );

    expect(requests).toEqual([handshakeUrl, "https://api.clerk.com/v1/jwks"]);
    expect(response.headers.getSetCookie()).toEqual(directives);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    if (instanceType === "production") {
      expect(response.status).toBe(200);
      expect(response.headers.get("x-frontend-continue")).toBe("1");
      expect(response.headers.get("Location")).toBeNull();
    } else {
      expect(response.status).toBe(307);
      expect(response.headers.get("x-frontend-continue")).toBeNull();
      expect(response.headers.get("Location")).toBe(`${ORIGIN}/account?tab=profile`);
    }
  },
);

it.each(["text/html", "text/x-component"])(
  "ローカルのRSA・JWKSテストデータを使った実Clerk SDKのセッション検証 / 実SDKの未ログイン%sリクエストを独自のログイン転送なしで処理する",
  async (accept) => {
    const response = await synchronizeFrontendSession(
      new Request(`${ORIGIN}/account?tab=profile`, { headers: { accept } }),
      configuration,
    );
    expectContinue(response);
    expect(requests).toEqual([]);
  },
);
