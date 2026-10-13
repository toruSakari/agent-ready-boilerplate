import { withRequestLogging } from "@dev-template/config/request-logging";
import { i18nMiddleware } from "@dev-template/client/i18n/server";
import { env } from "cloudflare:workers";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { withSecurityHeaders } from "@dev-template/config/security";
import { proxyApiRequest } from "@dev-template/config/proxy";
import { proxy } from "#admin/_app/server/proxy.ts";

const start = createStartHandler(defaultStreamHandler);
export default {
  fetch: withRequestLogging(
    withSecurityHeaders(
      async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/api" || path.startsWith("/api/")) {
          return proxyApiRequest(request, env.API);
        }

        const decision = await proxy(request);
        if (decision.headers.get("x-frontend-continue") !== "1") {
          return decision;
        }

        const response = await i18nMiddleware(request, () =>
          start(request, {
            context: { nonce: request.headers.get("x-csp-nonce") ?? undefined },
          }),
        );
        const headers = new Headers(response.headers);
        for (const [key, value] of decision.headers) {
          if (!["x-frontend-continue", "set-cookie"].includes(key)) {
            headers.set(key, value);
          }
        }

        // Cookieで変わるHTMLとRPC応答を共有キャッシュへ保存させない。
        headers.set("Cache-Control", "private, no-store");
        for (const cookie of decision.headers.getSetCookie()) {
          headers.append("Set-Cookie", cookie);
        }

        return new Response(response.body, { status: response.status, headers });
      },
      {
        publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        development: import.meta.env.DEV,
      },
    ),
    "admin",
  ),
};
