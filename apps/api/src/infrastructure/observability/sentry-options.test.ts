import { expect, it, vi } from "vite-plus/test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { ErrorEvent } from "@sentry/cloudflare";
import {
  createSentryOptions,
  maskSentryEvent,
} from "#api/infrastructure/observability/sentry-options.ts";

const options = createSentryOptions({ APP_ENV: "production", SENTRY_DSN: "" });

it("Sentryの個人情報保護 / 実際のSDKがAPIミドルウェアの前に要求本文を読まない", async () => {
  // インストール済みSDKの入口を通し、設定値の比較だけでは検出できない先行読み込みを確認する。
  const require = createRequire(import.meta.url);
  const sdk = dirname(require.resolve("@sentry/cloudflare/package.json"));
  const { captureIncomingRequestBody } = require(
    join(sdk, "build/cjs/prod/integrations/httpServer.js"),
  );
  const integration =
    typeof options.integrations === "function"
      ? options.integrations([]).find((entry) => entry.name === "HttpServer")
      : options.integrations?.[0];
  const request = new Request("https://api.example.test/api/trpc/access.acceptInvitation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "invite-secret", email: "person@example.test" }),
  });
  const clone = vi.spyOn(request, "clone");
  await captureIncomingRequestBody({ getIntegrationByName: () => integration }, request);
  expect(clone).not.toHaveBeenCalled();
  expect(request.bodyUsed).toBe(false);
  expect(options.dataCollection?.httpBodies).toEqual([]);
  expect(options.dataCollection?.httpHeaders).toBe(false);
  expect(options.dataCollection?.cookies).toBe(false);
  expect(options.dataCollection?.userInfo).toBe(false);
});

it("Sentryの個人情報保護 / consoleの自動収集とcauseの探索を停止し、Logs/Metricsは送信しない", () => {
  const names =
    typeof options.integrations === "function"
      ? options
          .integrations([
            { name: "Console" },
            { name: "LinkedErrors" },
            { name: "HttpServer" },
            { name: "Dedupe" },
          ])
          .map((entry) => entry.name)
      : [];
  expect(names).toEqual(["Dedupe", "HttpServer"]);
  expect(options.beforeSendLog?.({ level: "error", message: "person@example.test" })).toBeNull();
  expect(
    options.beforeSendMetric?.({
      name: "person@example.test",
      type: "counter",
      value: 1,
    }),
  ).toBeNull();
});

it("Sentryの個人情報保護 / 本文・ヘッダー・URL・user・breadcrumb・例外の個人情報を送信しない", () => {
  const secret = "person@example.test invite-secret";
  const event: ErrorEvent = {
    type: undefined,
    event_id: "00000000000000000000000000000001",
    level: "error",
    message: secret,
    user: { email: secret },
    extra: { secret },
    tags: { secret },
    request: {
      url: `https://example.test/${secret}`,
      data: { token: secret },
      headers: { cookie: secret },
    },
    breadcrumbs: [{ message: secret, data: { secret } }],
    contexts: { custom: { secret } },
    exception: {
      values: [
        {
          type: secret,
          value: secret,
          stacktrace: {
            frames: [
              {
                filename: "worker-entry.js",
                lineno: 10,
                colno: 2,
                function: secret,
                vars: { token: secret },
                pre_context: [secret],
              },
            ],
          },
        },
      ],
    },
  };
  const result = maskSentryEvent(event);
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(result.request).toBeUndefined();
  expect(result.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
    filename: "worker-entry.js",
    lineno: 10,
    colno: 2,
    in_app: undefined,
  });
  expect(result.event_id).toBe(event.event_id);
  expect(event.message).toBe(secret);
});

it("Sentryの個人情報保護 / ストリーム形式のトレースも自由文や属性・リンクを送信しない", () => {
  const result = options.beforeSendSpan?.({
    trace_id: "00000000000000000000000000000001",
    span_id: "0000000000000001",
    name: "person@example.test",
    start_timestamp: 1,
    end_timestamp: 2,
    status: "error",
    is_segment: true,
    attributes: {
      "http.request.body.data": "invite-secret",
      "db.query.text": "person@example.test",
    },
    links: [],
  });
  expect(result?.name).toBe("worker operation");
  expect(result?.attributes).toEqual({});
  expect(result?.links).toBeUndefined();
  expect(result?.end_timestamp).toBe(2);
});
