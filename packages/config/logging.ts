export interface LogMetadata {
  count: number;
  deleted: number;
  failed: number;
  durationMs: number;
  requestId: string;
  orderId: string;
  reservationId: string;
  eventId: string;
  scope: "ip" | "subject";
  code: string;
  method: string;
  status: number;
  service: "web" | "business" | "admin" | "api";
  boundary: "worker" | "start" | "server_function";
}

export type LogField = keyof LogMetadata;

const eventBrand = Symbol("log event");

export interface LogEvent<Field extends LogField = LogField> {
  readonly name: string;
  readonly message: string;
  readonly fields: readonly Field[];
  readonly category?: "security";
  readonly [eventBrand]: true;
}

const events = new WeakSet<object>();

type Literal<Value extends string> = string extends Value ? never : Value;

/** 固定文言と許可項目は所有機能が定義する。利用者入力を定義へ渡さない。 */
export function defineLogEvent<
  const Name extends string,
  const Message extends string,
  const Fields extends readonly LogField[],
>(
  name: Literal<Name>,
  message: Literal<Message>,
  fields: Fields,
  category?: "security",
): LogEvent<Fields[number]> {
  if (typeof name !== "string" || typeof message !== "string" || !/^[a-z][a-z0-9_.]*$/.test(name)) {
    throw new Error("ログイベント名の形式が不正です");
  }

  const event = Object.freeze({
    name,
    message,
    fields: Object.freeze([...fields]),
    category: category === "security" ? category : undefined,
    [eventBrand]: true as const,
  });
  events.add(event);
  return event;
}

const filtered = "[Filtered]";
const countKeys = new Set(["count", "deleted", "failed", "durationMs"]);
const idKeys = new Set(["requestId", "orderId", "reservationId", "eventId"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errorCodes = new Set([
  "INTERNAL_SERVER_ERROR",
  "BAD_GATEWAY",
  "GATEWAY_TIMEOUT",
  "SERVICE_UNAVAILABLE",
  "NOT_IMPLEMENTED",
]);
const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const allFields: LogField[] = [
  "count",
  "deleted",
  "failed",
  "durationMs",
  "requestId",
  "orderId",
  "reservationId",
  "eventId",
  "scope",
  "code",
  "method",
  "status",
  "service",
  "boundary",
];

function isCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}

function isOneOf(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === "string" && allowed.has(value);
}

const fieldValidators: Partial<Record<LogField, (value: unknown) => boolean>> = {
  scope: (value) => isOneOf(value, new Set(["ip", "subject"])),
  code: (value) => isOneOf(value, errorCodes),
  method: (value) => isOneOf(value, methods),
  status: isStatus,
  service: (value) => isOneOf(value, new Set(["web", "business", "admin", "api"])),
  boundary: (value) => isOneOf(value, new Set(["worker", "start", "server_function"])),
};

function allowedLogValue(key: string, value: unknown) {
  if (countKeys.has(key)) {
    return isCount(value);
  }

  if (idKeys.has(key)) {
    return typeof value === "string" && uuid.test(value);
  }

  return fieldValidators[key as LogField]?.(value) ?? false;
}

/** 未知の項目は値を取得せずに伏せる。項目名と値の形式の両方を許可リストで確認する。 */
export function maskLogData(
  data: object,
  fields: readonly LogField[] = allFields,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(data).map((key) => {
      if (!fields.some((field) => field === key) || !allFields.some((field) => field === key)) {
        return ["filtered", filtered];
      }

      const value: unknown = Reflect.get(data, key);
      const allowed = allowedLogValue(key, value);
      return allowed ? [key, value] : ["filtered", filtered];
    }),
  );
}

/** 共通層は出力とマスキングだけを担当し、業務イベント・文言を所有しない。 */
type EventData<Field extends LogField> = [Field] extends [never]
  ? Record<string, never>
  : Partial<Pick<LogMetadata, NoInfer<Field>>>;

function eventIdentity(event: LogEvent) {
  if (typeof event !== "object" || event === null || !events.has(event)) {
    return { event: "unknown_event", message: "処理イベントを確認してください", fields: [] };
  }

  return {
    event: event.name,
    message: event.message,
    fields: event.fields,
    category: event.category,
  };
}

export function logEvent<Field extends LogField>(
  level: "info" | "warn" | "error",
  event: LogEvent<Field>,
  data?: EventData<NoInfer<Field>>,
): void;

export function logEvent(level: "info" | "warn" | "error", event: LogEvent, data: object = {}) {
  const identity = eventIdentity(event);
  const entry = {
    level,
    event: identity.event,
    message: identity.message,
    ...(identity.category ? { category: identity.category } : {}),
    ...maskLogData(data, identity.fields),
  };
  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}
