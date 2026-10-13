import { defineLogEvent, logEvent } from "#config/logging.js";

const apiProxyFailed = defineLogEvent("api_proxy_failed", "共通APIへの接続に失敗しました", []);

/** 同一オリジンのAPI要求をサービスBindingへ転送する。認証・業務認可は転送先APIが担う。 */
export async function proxyApiRequest(
  request: Request,
  api: { fetch(input: string, init?: RequestInit): Promise<Response> },
) {
  const path = new URL(request.url).pathname;
  // 旧サービス別RPCや任意のWorkerパスへ転送せず、共通APIの公開入口だけを通す。
  const allowed = path === "/api/health" || path.startsWith("/api/trpc/");
  if (!allowed) {
    return Response.json(
      { error: "APIが見つかりません", code: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // 本文はAPIが認証・スロットル・認可を通過して読むまで転送側でバッファーしない。
  // 実バイト上限はAPIの遅延ストリームが所有する。
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : request.body;
  // 接続や宛先、ストリームの長さはfetch側に任せる。
  const forwarded = new Headers(request.headers);
  for (const name of ["connection", "transfer-encoding", "host", "content-length"]) {
    forwarded.delete(name);
  }

  // 同一ゾーンのWorker間要求ではCF-Connecting-IPがX-Real-IPから導出されるため、
  // クライアント指定のX-Real-IPを転送せず、Cloudflareが付与した接続元で上書きする。
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) {
    forwarded.set("x-real-ip", clientIp);
  } else {
    forwarded.delete("x-real-ip");
  }

  try {
    // URLとinitを分けて渡し、Service Bindingのfetchへ必要な値だけを渡す。
    const response = await api.fetch(request.url, {
      method: request.method,
      headers: Object.fromEntries(forwarded),
      body,
      ...(body ? { duplex: "half" } : {}),
      redirect: "manual",
    });
    // 利用者・企業によって内容が変わるため、成功・失敗とも共有キャッシュへ残さない。
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    // 上流例外には認証情報が混ざり得るため、ログと応答には固定文言だけを出す。
    logEvent("error", apiProxyFailed);
    return Response.json(
      { error: "処理に失敗しました。しばらくしてから再試行してください" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  } finally {
    // APIが読まずに拒否した本文も残さず、送信元へ中断を伝える。
    if (body && !body.locked) {
      await body.cancel().catch(() => {});
    }
  }
}
