import { expect, it, vi } from "vite-plus/test";
import { defineLogEvent, logEvent, maskLogData } from "@dev-template/config/logging";

const rateLimit = defineLogEvent("rate_limit", "要求数の制限を超えました", ["scope"], "security");

it(
  "ログの個人情報保護" + " / " + "許可した技術情報だけを保持し、未知のキー・入れ子・自由文を伏せる",
  () => {
    const result = maskLogData({
      count: 2,
      durationMs: 15,
      orderId: "00000000-0000-4000-8000-000000000001",
      scope: "ip",
      code: "INTERNAL_SERVER_ERROR",
      email: "person@example.test",
      body: { password: "secret", invitationToken: "invite-secret" },
      error: new Error("person@example.test"),
      "person@example.test": "secret",
    });
    expect(result).toEqual({
      count: 2,
      durationMs: 15,
      orderId: "00000000-0000-4000-8000-000000000001",
      scope: "ip",
      code: "INTERNAL_SERVER_ERROR",
      filtered: "[Filtered]",
    });
    expect(
      maskLogData({
        orderId: "person@example.test",
        count: NaN,
        scope: "secret",
        service: { toString: () => "web", email: "person@example.test" },
      }),
    ).toEqual({ filtered: "[Filtered]" });
  },
);

it("ログの個人情報保護" + " / " + "未知の項目の値を取得しない", () => {
  const data = Object.defineProperty({}, "body", {
    enumerable: true,
    get() {
      throw new Error("秘密情報の取得は禁止");
    },
  });
  expect(maskLogData(data)).toEqual({ filtered: "[Filtered]" });
});

it(
  "ログの個人情報保護" + " / " + "イベントごとの許可項目に絞り、別イベントの許可項目も取得しない",
  () => {
    const data = Object.defineProperty({ scope: "ip" }, "orderId", {
      enumerable: true,
      get() {
        throw new Error("別のイベントの項目です");
      },
    });
    expect(maskLogData(data, rateLimit.fields)).toEqual({ scope: "ip", filtered: "[Filtered]" });
  },
);

it.each([
  "person@example.test",
  { name: "rate_limit", message: "person@example.test", fields: [] },
  { ...rateLimit },
])("ログの個人情報保護" + " / " + "未登録・偽造したイベントを記録しない: %j", (event) => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    Reflect.apply(logEvent, undefined, ["error", event]);
    expect(JSON.parse(error.mock.calls[0]![0])).toEqual({
      level: "error",
      event: "unknown_event",
      message: "処理イベントを確認してください",
    });
  } finally {
    error.mockRestore();
  }
});

it(
  "ログの個人情報保護" +
    " / " +
    "不明なメタデータで固定メッセージ・イベント・カテゴリを上書きできない",
  () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      Reflect.apply(logEvent, undefined, [
        "warn",
        rateLimit,
        {
          message: "person@example.test",
          event: "secret",
          category: "secret",
          scope: "subject",
          count: 1,
        },
      ]);
      expect(JSON.parse(warn.mock.calls[0]![0])).toEqual({
        level: "warn",
        event: "rate_limit",
        message: "要求数の制限を超えました",
        category: "security",
        scope: "subject",
        filtered: "[Filtered]",
      });
      expect(Object.isFrozen(rateLimit)).toBe(true);
      expect(Object.isFrozen(rateLimit.fields)).toBe(true);
    } finally {
      warn.mockRestore();
    }
  },
);
