import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApplicationError } from "#api/application/shared/application-error.ts";

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** 運営操作の追加境界。サービス会員・権限の検査とは別にAccess JWTを検証する。 */
export async function verifyAdminAccess(
  request: Request,
  config: { APP_ENV: string; ADMIN_ACCESS_ISSUER?: string; ADMIN_ACCESS_AUDIENCE?: string },
) {
  // ローカル設定だけでは免除せず、実際の接続先もループバックの場合に限る。
  if (
    config.APP_ENV === "local" &&
    new URL(request.url).hostname.match(/^(localhost|127\.0\.0\.1)$/)
  ) {
    return;
  }

  const issuer = config.ADMIN_ACCESS_ISSUER;
  const audience = config.ADMIN_ACCESS_AUDIENCE;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!issuer || !audience || !token) {
    throw new ApplicationError({
      code: "FORBIDDEN",
      message: "運営管理画面からアクセスしてください",
    });
  }

  // 設定由来の鍵取得先もCloudflare AccessのHTTPSドメインに限定する。
  const issuerUrl = new URL(issuer);
  if (!isAccessIssuer(issuerUrl)) {
    throw new Error("Cloudflare Accessの発行者設定が不正です");
  }

  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
    keySets.set(issuer, keys);
  }

  try {
    await jwtVerify(token, keys, {
      issuer: issuer.replace(/\/$/, ""),
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub"],
    });
  } catch {
    throw new ApplicationError({
      code: "FORBIDDEN",
      message: "運営管理画面の認証が無効です。ログインし直してください",
    });
  }
}

/** 設定由来の鍵取得先にも、Cloudflare Accessの発行者だけを認める。 */
function isAccessIssuer(url: URL) {
  return (
    url.protocol === "https:" &&
    url.hostname.endsWith(".cloudflareaccess.com") &&
    url.pathname === "/"
  );
}
