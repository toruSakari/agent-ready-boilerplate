import { createClerkClient } from "@clerk/backend";
import { parsePublishableKey } from "@clerk/shared/keys";

// 継続の判断はWorkerが消費し、この内部ヘッダーをブラウザーへ返さない。
export function continueFrontendRequest(headers?: Headers) {
  const result = new Headers(headers);
  result.set("x-frontend-continue", "1");
  return new Response(null, { headers: result });
}

export interface FrontendAuthEnvironment {
  APP_ENV?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
}

export interface FrontendSessionOptions {
  environment: FrontendAuthEnvironment;
  publishableKey: string | undefined;
  development: boolean;
}

const PRIVATE_CACHE_CONTROL = "private, no-store";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ASSET_PATH_PREFIXES = ["/assets", "/_next/static", "/_next/image"];
const LOCAL_MODULE_PATH_PREFIXES = ["/@vite", "/@id", "/@fs", "/node_modules", "/src", "/app"];

// 単純な前方一致で /api-other などを除外せず、パスの区切りまで一致させる。
function atOrBelow(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`);
}

function privateHeaders(source?: Headers) {
  const headers = new Headers(source);
  headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  return headers;
}

function unavailable() {
  return new Response("認証を確認できません。しばらくしてから再試行してください", {
    status: 503,
    headers: privateHeaders(),
  });
}

// 許可元はoriginそのものに限定する。パス付きURLや空要素を黙って補正しない。
function configuredOrigins(value: string | undefined, local: boolean): string[] {
  const origins = value?.split(",").map((origin) => origin.trim()) ?? [];
  if (!origins.length || origins.some((origin) => !origin)) {
    throw new Error("Missing origins");
  }

  for (const origin of origins) {
    if (!validConfiguredOrigin(origin, local)) {
      throw new Error("Invalid origin");
    }
  }

  return origins;
}

function validConfiguredOrigin(origin: string, local: boolean) {
  const url = new URL(origin);
  if (url.origin !== origin) {
    return false;
  }

  if (url.protocol === "https:") {
    return true;
  }

  return local && url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname);
}

function isTechnicalRequest(path: string, local: boolean) {
  if (atOrBelow(path, "/api")) {
    return true;
  }

  if (ASSET_PATH_PREFIXES.some((prefix) => atOrBelow(path, prefix))) {
    return true;
  }

  if (["/favicon.ico", "/robots.txt", "/sitemap.xml"].includes(path)) {
    return true;
  }

  if (!local) {
    return false;
  }

  return (
    path === "/@react-refresh" ||
    LOCAL_MODULE_PATH_PREFIXES.some((prefix) => atOrBelow(path, prefix))
  );
}

function isDocumentRequest(request: Request) {
  const destination = request.headers.get("sec-fetch-dest");
  return (
    ["GET", "HEAD"].includes(request.method) &&
    (destination === "document" ||
      destination === "iframe" ||
      (!destination && (request.headers.get("accept") ?? "").startsWith("text/html")))
  );
}

/**
 * ClerkのCookieとハンドシェイクを同期する。
 * 画面の利用条件は各アプリのlayout、データの認可はAPIが所有し、ここではルート方針を推測しない。
 */
export async function synchronizeFrontendSession(
  request: Request,
  options: FrontendSessionOptions,
) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  // 開発ビルド・環境名・loopbackの三条件を満たす要求だけをローカルデモとして扱う。
  const local =
    options.development &&
    options.environment.APP_ENV === "local" &&
    LOCAL_HOSTNAMES.has(url.hostname);

  // これは技術的な通信・アセットの除外。公開ページ一覧やサービス資格の判定ではない。
  if (isTechnicalRequest(path, local)) {
    return continueFrontendRequest();
  }

  // 鍵なしを許すのはローカルデモだけ。本番・Previewの設定漏れでは同期を成功扱いにしない。
  if (local && !options.publishableKey && !options.environment.CLERK_SECRET_KEY) {
    return continueFrontendRequest(privateHeaders());
  }

  try {
    return await synchronizeClerkRequest(request, options, local, url);
  } catch {
    // 認証基盤の例外、鍵、セッショントークン、要求ヘッダーを応答へ漏らさない。
    return unavailable();
  }
}

async function synchronizeClerkRequest(
  request: Request,
  options: FrontendSessionOptions,
  local: boolean,
  url: URL,
) {
  const { CLERK_SECRET_KEY, CLERK_AUTHORIZED_PARTIES } = options.environment;
  if (!CLERK_SECRET_KEY || !options.publishableKey) {
    return unavailable();
  }

  const authorizedParties = configuredOrigins(CLERK_AUTHORIZED_PARTIES, local);
  if (!authorizedParties.includes(url.origin)) {
    return new Response("このオリジンは許可されていません", {
      status: 403,
      headers: privateHeaders(),
    });
  }

  const { frontendApi } = parsePublishableKey(options.publishableKey, { fatal: true });
  const expectedIssuer = `https://${frontendApi}`;
  const headers = new Headers(request.headers);
  // Clerkは信頼済みプロキシの転送ヘッダーを解釈するが、公開要求のヘッダーは偽装できる。
  // 宛先判断に使わせず、検証した要求URLをSDKへ渡す。
  for (const name of [
    "host",
    "x-forwarded-host",
    "x-forwarded-proto",
    "cloudfront-forwarded-proto",
  ]) {
    headers.delete(name);
  }

  const state = await createClerkClient({
    secretKey: CLERK_SECRET_KEY,
    publishableKey: options.publishableKey,
  }).authenticateRequest(new Request(request.url, { method: request.method, headers }), {
    acceptsToken: "session_token",
    authorizedParties,
  });
  return synchronizedResponse(request, state, expectedIssuer, authorizedParties, url);
}

type ClerkRequestState = Awaited<
  ReturnType<ReturnType<typeof createClerkClient>["authenticateRequest"]>
>;

function synchronizedResponse(
  request: Request,
  state: ClerkRequestState,
  expectedIssuer: string,
  authorizedParties: string[],
  url: URL,
) {
  const responseHeaders = privateHeaders(state.headers);
  const location = responseHeaders.get("Location");
  if (location) {
    if (!isDocumentRequest(request)) {
      responseHeaders.delete("Location");
      // fetchでは外部originのハンドシェイクを完了できないため、クライアントにdocument再試行を促す。
      return new Response("認証情報を更新してください", {
        status: 401,
        headers: responseHeaders,
      });
    }

    const destination = new URL(location, url.origin);
    // SDKの応答でも無条件に転送せず、このアプリか設定したClerkインスタンスに遷移先を絞る。
    if (![url.origin, expectedIssuer].includes(destination.origin)) {
      return unavailable();
    }

    return new Response(null, { status: 307, headers: responseHeaders });
  }

  if (state.status === "handshake") {
    return unavailable();
  }

  if (!validSessionClaims(state, expectedIssuer, authorizedParties)) {
    return unavailable();
  }

  // 未ログインでも公開shellは描画できる。保護ページへの適用はアプリのlayoutが決める。
  return continueFrontendRequest(responseHeaders);
}

function validSessionClaims(
  state: ClerkRequestState,
  expectedIssuer: string,
  authorizedParties: string[],
) {
  if (!state.isAuthenticated) {
    return true;
  }

  // MFA待ちのCookie同期は許可するが、画面ガードとAPIが利用資格を別途検証する。
  const auth = state.toAuth({ treatPendingAsSignedOut: false });
  return (
    !!auth?.userId &&
    !!auth.sessionId &&
    auth.sessionClaims.iss === expectedIssuer &&
    authorizedParties.includes(auth.sessionClaims.azp ?? "")
  );
}
