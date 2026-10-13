import { AsyncLocalStorage } from "node:async_hooks";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { defineLogEvent, logEvent } from "#config/logging.js";
import type { LogMetadata } from "#config/logging.js";

interface RequestLogContext {
  requestId: string;
  service?: LogMetadata["service"];
}

const requests = new AsyncLocalStorage<RequestLogContext>();
const requestFields = [
  "requestId",
  "service",
  "boundary",
  "method",
  "status",
  "durationMs",
] as const;
const requestCompleted = defineLogEvent(
  "request_completed",
  "要求の処理を完了しました",
  requestFields,
);
const requestFailed = defineLogEvent("request_failed", "要求の処理に失敗しました", requestFields);
const functionCompleted = defineLogEvent(
  "server_function_completed",
  "サーバー関数の処理を完了しました",
  requestFields,
);
const functionFailed = defineLogEvent(
  "server_function_failed",
  "サーバー関数の処理に失敗しました",
  requestFields,
);

function inRequestContext<Result>(next: () => Promise<Result>): Promise<Result> {
  return requests.getStore() ? next() : requests.run({ requestId: crypto.randomUUID() }, next);
}

function metadata(
  boundary: LogMetadata["boundary"],
  method: string,
  started: number,
  status?: number,
) {
  const context = requests.getStore();
  return {
    requestId: context?.requestId,
    ...(context?.service ? { service: context.service } : {}),
    boundary,
    // 任意のmethodも共通フィルターで許可されたHTTPメソッドだけを残す。
    ...(typeof method === "string" ? { method } : {}),
    ...(status === undefined ? {} : { status }),
    durationMs: Math.max(0, performance.now() - started),
  };
}

/** 本文・URL・ヘッダー・例外を収集せず、要求ごとの時間と結果を記録する。 */
export function observeRequest<Result>(
  boundary: "worker" | "start",
  request: Request,
  next: () => Promise<Result> | Result,
  statusOf: (result: Result) => number,
): Promise<Result> {
  return inRequestContext(async () => {
    const started = performance.now();
    try {
      const result = await next();
      const status = statusOf(result);
      logEvent(
        status >= 500 ? "error" : "info",
        requestCompleted,
        metadata(boundary, request.method, started, status),
      );
      return result;
    } catch (error) {
      // Routerの遷移・未検出は正常な制御フローとして保持し、例外本文は記録しない。
      if (isRedirect(error) || isNotFound(error)) {
        const status = isRedirect(error) ? error.status || 302 : 404;
        logEvent("info", requestCompleted, metadata(boundary, request.method, started, status));
      } else {
        logEvent("error", requestFailed, metadata(boundary, request.method, started));
      }

      throw error;
    }
  });
}

function failedFunctionResult(result: unknown) {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return false;
  }

  return !!result.error && !isRedirect(result.error) && !isNotFound(result.error);
}

/** HTTPを使わないSSR中の直接呼び出しも同じサーバー境界で計測する。入力・結果は記録しない。 */
export function observeServerFunction<Result>(
  method: string,
  next: () => Promise<Result>,
): Promise<Result> {
  return inRequestContext(async () => {
    const started = performance.now();
    try {
      const result = await next();
      const failed = failedFunctionResult(result);
      logEvent(
        failed ? "error" : "info",
        failed ? functionFailed : functionCompleted,
        metadata("server_function", method, started),
      );
      return result;
    } catch (error) {
      const failed = !isRedirect(error) && !isNotFound(error);
      logEvent(
        failed ? "error" : "info",
        failed ? functionFailed : functionCompleted,
        metadata("server_function", method, started),
      );
      throw error;
    }
  });
}

/** 利用者指定のIDを信用せず、Worker入口で相関IDを発行する。要求間で文脈を共有しない。 */
export function withRequestLogging<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Response | Promise<Response>,
  service: LogMetadata["service"],
) {
  return (request: Request, ...args: Args): Promise<Response> =>
    requests.run({ requestId: crypto.randomUUID(), service }, () =>
      observeRequest(
        "worker",
        request,
        () => handler(request, ...args),
        (response) => response.status,
      ),
    );
}
