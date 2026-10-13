import { parsePublishableKey } from "@clerk/shared/keys";

/** アプリごとに同じヘッダー方針を適用し、nonceは外部ヘッダーを信用せず要求ごとに発行する。 */
export function withSecurityHeaders<Args extends unknown[]>(
  fetch: (request: Request, ...args: Args) => Response | Promise<Response>,
  options: { publishableKey?: string; development?: boolean } = {},
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
    const policy = contentSecurityPolicy(request, nonce, options);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Content-Security-Policy", policy);
    requestHeaders.set("x-csp-nonce", nonce);
    const response = await fetch(new Request(request, { headers: requestHeaders }), ...args);
    if (response.status === 101) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", policy);
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (new URL(request.url).protocol === "https:") {
      headers.set("Strict-Transport-Security", "max-age=31536000");
    }

    // nonce付きHTMLとRSCを別要求で再利用するとCSPが不一致になるため、共有キャッシュに保存しない。
    if ((headers.get("Content-Type") ?? "").match(/text\/html|text\/x-component/)) {
      headers.set("Cache-Control", "private, no-store");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

function contentSecurityPolicy(
  request: Request,
  nonce: string,
  options: NonNullable<Parameters<typeof withSecurityHeaders>[1]>,
) {
  const clerk = options.publishableKey
    ? `https://${parsePublishableKey(options.publishableKey, { fatal: true }).frontendApi}`
    : "";
  const development =
    options.development &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${clerk} https://*.clerk.com https://*.clerk.accounts.dev${development ? " ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*" : ""}`,
    "img-src 'self' data: blob: https://img.clerk.com",
    "font-src 'self' data:",
    `frame-src ${clerk || "'self'"} https://challenges.cloudflare.com`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${clerk}`,
  ].join("; ");
}
