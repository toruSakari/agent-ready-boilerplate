import { logEvent } from "@dev-template/config/logging";
import { throttleRequests } from "#api/presentation/shared/middleware/request-throttle.ts";
import { MAX_RPC_BATCH_SIZE } from "#api/application/security/policies/request-limits.ts";
import { recordSecurityEvent } from "#api/presentation/shared/security-events.ts";
import { trpcServer } from "@hono/trpc-server";
import { apiErrorResponse, apiFailureEvent } from "#api/presentation/shared/errors.ts";
import { Hono } from "hono";
import type { Context } from "hono";

import { appRouter } from "#api/presentation/app-router.ts";
import { createTrpcContext } from "#api/presentation/shared/trpc-core.ts";

import { limitTrpcRequestBody } from "#api/presentation/shared/middleware/limit-trpc-body.ts";

import { authenticateRequest } from "#api/presentation/shared/middleware/authentication.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";

const app = new Hono<RequestActorEnv>().basePath("/api");
app.onError(apiErrorResponse);
// 会員や企業ごとに内容が変わるため、成功・失敗を含め共有キャッシュへ保存させない。
app.use("*", async (context, next) => {
  await next();
  context.header("Cache-Control", "private, no-store");
  context.header("X-Content-Type-Options", "nosniff");
});
app.notFound((context) => context.json({ error: "APIが見つかりません", code: "NOT_FOUND" }, 404));

// インフラの死活確認は公開し、サービス会員を確認するRPCのhealthとは分ける。
app.get("/health", (context) => context.json({ status: "ok" }));
// 認可は共通URL配下の各手続きが所有し、会員種別と現在権限を操作ごとに検査する。
app.use(
  "/trpc/*",
  throttleRequests("ip"),
  authenticateRequest,
  throttleRequests("subject"),
  limitTrpcRequestBody,
  trpcServer({
    endpoint: "/api/trpc",
    maxBatchSize: MAX_RPC_BATCH_SIZE,
    router: appRouter,
    onError: (props) => {
      if (props.error.code === "UNAUTHORIZED" || props.error.code === "FORBIDDEN") {
        recordSecurityEvent(
          props.error.code === "UNAUTHORIZED"
            ? "authentication_rejected"
            : "authorization_rejected",
        );
      }

      if (props.error.code === "INTERNAL_SERVER_ERROR") {
        logEvent("error", apiFailureEvent, { code: props.error.code });
      }
    },
    createContext: (options, context: Context<RequestActorEnv>) =>
      createTrpcContext(context.req.raw, options.info, context.var),
  }),
);

export const apiApp = app;
