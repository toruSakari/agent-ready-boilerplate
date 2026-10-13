import { defineLogEvent, logEvent } from "@dev-template/config/logging";
import * as Sentry from "@sentry/cloudflare";

const securityEvents = {
  authentication_rejected: defineLogEvent(
    "authentication_rejected",
    "認証を拒否しました",
    ["scope"],
    "security",
  ),
  authorization_rejected: defineLogEvent(
    "authorization_rejected",
    "権限不足により操作を拒否しました",
    ["scope"],
    "security",
  ),
  rate_limit: defineLogEvent("rate_limit", "要求数の制限を超えました", ["scope"], "security"),
  throttle_unavailable: defineLogEvent(
    "throttle_unavailable",
    "要求制限基盤を確認できません",
    ["scope"],
    "security",
  ),
};

type SecurityEvent = keyof typeof securityEvents;

/** トークン・IP・メール・入力をログへ含めず、集計と通知に使う固定イベントだけを記録する。 */
export function recordSecurityEvent(
  event: SecurityEvent,
  details: { scope?: "ip" | "subject" } = {},
) {
  const definition = securityEvents[event];
  logEvent("warn", definition, details);
  // 高頻度の拒否はWorkerログを集計する。基盤停止だけをSentryへ直接通知して通知洪水を防ぐ。
  if (event === "throttle_unavailable") {
    Sentry.captureMessage(definition.message, {
      level: "error",
      tags: { event },
    });
  }
}
