import type { defineLogEvent, LogEvent, logEvent } from "@dev-template/config/logging";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Assert<Value extends true> = Value;

// ログの内容を広げる変更でコンパイルが成功しないよう、公開契約を検証する。
export type EventFieldsContract = Assert<
  Equal<keyof NonNullable<Parameters<typeof logEvent<"count">>[2]>, "count">
>;

export type DynamicNameContract = Assert<
  Equal<Parameters<typeof defineLogEvent<string, "固定文言", readonly []>>[0], never>
>;

export type DynamicMessageContract = Assert<
  Equal<Parameters<typeof defineLogEvent<"event_name", string, readonly []>>[1], never>
>;

export type RegisteredEventContract = Assert<
  Equal<
    { name: string; message: string; fields: readonly "count"[] } extends LogEvent<"count">
      ? true
      : false,
    false
  >
>;

export type NoFieldsContract = Assert<
  Equal<NonNullable<Parameters<typeof logEvent<never>>[2]>["body"], never>
>;
