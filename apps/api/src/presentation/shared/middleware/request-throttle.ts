import { rpcBatchSize } from "#api/presentation/shared/middleware/rpc-batch-size.ts";
import { throttleError } from "#api/presentation/shared/middleware/throttle-error.ts";
import { env } from "cloudflare:workers";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { Context } from "hono";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import { MAX_RPC_BATCH_SIZE } from "#api/application/security/policies/request-limits.ts";
import { recordSecurityEvent } from "#api/presentation/shared/security-events.ts";

const resultSchema = z.object({ allowed: z.boolean(), retryAfter: z.number().int().nonnegative() });

async function consume(scope: "ip" | "subject", key: string, cost: number) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${scope}:${key}`));
  const name = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
  const binding = env.REQUEST_THROTTLE;
  if (!binding) {
    throw new Error("要求制限のBindingが必要です");
  }

  const response = await binding.get(binding.idFromName(name)).fetch("https://throttle.internal/", {
    method: "POST",
    body: JSON.stringify({ scope, cost }),
  });
  if (!response.ok) {
    throw new Error("要求制限を確認できません");
  }

  return resultSchema.parse(await response.json());
}

function throttleKey(scope: "ip" | "subject", context: Context<RequestActorEnv>) {
  if (scope === "ip") {
    return context.req.header("cf-connecting-ip");
  }

  return context.var.actor?.subjectId ?? context.var.actor?.userId;
}

/** 本人確認前のIP制限と、確認済みsubjectの操作数制限をそれぞれの境界へ接続する。 */
export function throttleRequests(scope: "ip" | "subject") {
  return createMiddleware<RequestActorEnv>(async (context, next) => {
    if (scope === "subject" && !context.var.actor) {
      return next();
    }

    const key = throttleKey(scope, context);
    // ローカルfixtureにも偽造IPを信用する例外を設けない。Bindingがあればunknownの共有枠で制限する。
    if (!env.REQUEST_THROTTLE && env.APP_ENV === "local") {
      return next();
    }

    const calls = rpcBatchSize(new URL(context.req.url));
    if (calls > MAX_RPC_BATCH_SIZE) {
      return throttleError(context, 400, "一度に実行する操作が多すぎます");
    }

    try {
      const result = await consume(scope, key ?? "unknown", scope === "subject" ? calls : 1);
      if (!result.allowed) {
        recordSecurityEvent("rate_limit", { scope });
        context.header("Retry-After", String(Math.max(1, result.retryAfter)));
        return throttleError(
          context,
          429,
          "リクエストが多すぎます。しばらくしてから再試行してください",
        );
      }
    } catch {
      // 本番で制限基盤が停止しても、認証・DBへ無制限に流さない。
      recordSecurityEvent("throttle_unavailable", { scope });
      return throttleError(
        context,
        503,
        "要求制限を確認できません。しばらくしてから再試行してください",
      );
    }

    await next();
  });
}
