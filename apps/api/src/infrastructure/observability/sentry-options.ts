import { httpServerIntegration } from "@sentry/cloudflare";
import type { CloudflareOptions, ErrorEvent } from "@sentry/cloudflare";

const hexId = /^[0-9a-f]{16}(?:[0-9a-f]{16})?$/i;

/** 任意の例外文言やSDKの追加コンテキストは送らず、ソース位置と障害の相関情報だけを残す。 */
export function maskSentryEvent(event: ErrorEvent): ErrorEvent {
  const trace = event.contexts?.trace;
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    message:
      event.tags?.event === "throttle_unavailable"
        ? "要求制限基盤を確認できません"
        : "処理に失敗しました",
    tags: event.tags?.event === "throttle_unavailable" ? { event: "throttle_unavailable" } : {},
    contexts: traceContext(trace),
    exception: event.exception
      ? {
          values: event.exception.values?.map((exception) => ({
            type: "Error",
            value: "処理に失敗しました",
            stacktrace: exception.stacktrace
              ? {
                  frames: exception.stacktrace.frames?.map((frame) => {
                    // HTTP URL、クエリ、ローカル変数、動的な関数名は保持しない。
                    const filename = frame.filename?.split(/[\\/]/).at(-1);
                    return {
                      filename:
                        filename && /^[a-zA-Z0-9_.-]+\.(?:js|mjs|cjs|ts|tsx)$/.test(filename)
                          ? filename
                          : "[Filtered]",
                      lineno: frame.lineno,
                      colno: frame.colno,
                      in_app: frame.in_app,
                    };
                  }),
                }
              : undefined,
          })),
        }
      : undefined,
  };
}

/** 正しい形式の相関IDだけを残し、任意のtrace属性は捨てる。 */
function traceContext(trace: NonNullable<ErrorEvent["contexts"]>["trace"]) {
  return trace &&
    typeof trace.trace_id === "string" &&
    hexId.test(trace.trace_id) &&
    typeof trace.span_id === "string" &&
    hexId.test(trace.span_id)
    ? { trace: { trace_id: trace.trace_id, span_id: trace.span_id } }
    : {};
}

/** データ収集停止は送信前マスキングより前に必要。本文を読むだけでも容量制限の前に負荷が発生する。 */
export function createSentryOptions(env: Pick<Env, "SENTRY_DSN" | "APP_ENV">): CloudflareOptions {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    tracesSampleRate: env.APP_ENV === "production" ? 0.1 : 1,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    integrations: (defaults) => [
      ...defaults.filter(
        (integration) => !["Console", "LinkedErrors", "HttpServer"].includes(integration.name),
      ),
      httpServerIntegration({ maxRequestBodySize: "none" }),
    ],
    beforeSend: maskSentryEvent,
    // SDK v11の既定であるstream形式を明示し、フィルターが使われない構成変更を防ぐ。
    traceLifecycle: "stream",
    beforeSendSpan(span) {
      return {
        trace_id: span.trace_id,
        span_id: span.span_id,
        parent_span_id: span.parent_span_id,
        name: "worker operation",
        start_timestamp: span.start_timestamp,
        end_timestamp: span.end_timestamp,
        status: span.status,
        is_segment: span.is_segment,
        attributes: {},
      };
    },
  };
}
