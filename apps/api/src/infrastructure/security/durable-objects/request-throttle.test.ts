import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { RequestThrottle } from "#api/infrastructure/security/durable-objects/request-throttle.ts";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState) {}
  },
}));
const values = new Map<string, unknown>();
const alarm = vi.fn();

function state() {
  return {
    blockConcurrencyWhile: async (fn: () => Promise<unknown>) => fn(),
    storage: {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      setAlarm: alarm,
      deleteAll: async () => values.clear(),
    },
  } as unknown as DurableObjectState;
}

function create() {
  return new RequestThrottle(state(), {} as Env);
}

async function consume(object: RequestThrottle, cost = 20) {
  return (
    await object.fetch(
      new Request("https://internal/", {
        method: "POST",
        body: JSON.stringify({ scope: "subject", cost }),
      }),
    )
  ).json();
}

beforeEach(() => {
  values.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});
it("600操作を許可し、別Workerのインスタンスでも同じ保存枠から拒否する", async () => {
  const first = create();
  for (let i = 0; i < 30; i++) {
    expect(await consume(first)).toMatchObject({ allowed: true });
  }

  expect(await consume(create(), 1)).toEqual({ allowed: false, retryAfter: 1 });
});
it("拒否では残りの枠を減らさず、時間に比例して回復する", async () => {
  const object = create();
  for (let i = 0; i < 30; i++) {
    await consume(object);
  }

  expect(await consume(object, 20)).toEqual({ allowed: false, retryAfter: 2 });
  vi.advanceTimersByTime(100);
  expect(await consume(object, 1)).toMatchObject({ allowed: true });
  expect(await consume(object, 1)).toMatchObject({ allowed: false });
  vi.advanceTimersByTime(60_000);
  for (let i = 0; i < 30; i++) {
    expect(await consume(object)).toMatchObject({ allowed: true });
  }
});
it("休眠した枠はアラームで清掃する", async () => {
  const object = create();
  await consume(object);
  vi.advanceTimersByTime(120_000);
  await object.alarm();
  expect(values.size).toBe(0);
});
