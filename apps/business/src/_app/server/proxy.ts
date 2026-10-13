import { env } from "cloudflare:workers";
import { synchronizeFrontendSession, continueFrontendRequest } from "@dev-template/config/auth";

export function proxy(request: Request) {
  // 招待の#tokenはサーバーへ届かないため、ブラウザで回収してURLから消すまで外部Clerkへ転送しない。
  // 公開ページの判定ではなく、外部転送時のfragment継承による招待情報の漏えいを防ぐ例外。
  if (new URL(request.url).pathname.replace(/\/+$/, "") === "/invitations/accept") {
    return continueFrontendRequest(new Headers({ "Cache-Control": "private, no-store" }));
  }

  // ProxyはCookieとハンドシェイクの同期を担い、画面の利用条件は各route groupのlayoutで指定する。
  return synchronizeFrontendSession(request, {
    environment: env,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    development: import.meta.env.DEV,
  });
}
