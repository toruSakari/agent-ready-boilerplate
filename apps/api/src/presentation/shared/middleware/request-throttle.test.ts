import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import { throttleRequests } from "#api/presentation/shared/middleware/request-throttle.ts";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  idFromName: vi.fn((key: string) => key),
  event: vi.fn(),
  env: { APP_ENV: "production", REQUEST_THROTTLE: undefined as unknown },
}));
vi.mock("cloudflare:workers", () => ({ env: mocks.env }));
vi.mock("#api/presentation/shared/security-events.ts", () => ({
  recordSecurityEvent: mocks.event,
}));
const authenticate = vi.fn();
const app = new Hono<RequestActorEnv>();
app.use("/*", throttleRequests("ip"));
app.use("/*", async (c, next) => {
  authenticate();
  c.set("actor", {
    subjectId: "verified-subject",
    userId: "account",
    role: "member",
    tenantId: "",
    permissions: [],
  });
  await next();
});
app.use("/*", throttleRequests("subject"));
app.get("/*", (c) => c.json({ ok: true }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.REQUEST_THROTTLE = {
    idFromName: mocks.idFromName,
    get: () => ({ fetch: mocks.fetch }),
  };
  mocks.fetch.mockImplementation(async () => Response.json({ allowed: true, retryAfter: 0 }));
});
it("IP枠を本人確認前に、本人枠を確認後に消費し、生の識別子は保存しない", async () => {
  expect(
    (
      await app.request("https://example.com/api/trpc/order.list,product.list?batch=1", {
        headers: { "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "forged" },
      })
    ).status,
  ).toBe(200);
  expect(mocks.idFromName).toHaveBeenCalledTimes(2);
  expect(mocks.idFromName.mock.calls.map((props) => props[0])).toEqual([
    expect.stringMatching(/^[a-f0-9]{64}$/),
    expect.stringMatching(/^[a-f0-9]{64}$/),
  ]);
  expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body)).toEqual({ scope: "ip", cost: 1 });
  expect(JSON.parse(mocks.fetch.mock.calls[1]![1].body)).toEqual({ scope: "subject", cost: 2 });
});
it("IP上限では本人確認を実行せず429とRetry-Afterを返す", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ allowed: false, retryAfter: 3 }));
  const response = await app.request("https://example.com/api/trpc/order.list");
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("3");
  expect(authenticate).not.toHaveBeenCalled();
});
it("本人上限でも業務本体へ進めない", async () => {
  mocks.fetch
    .mockResolvedValueOnce(Response.json({ allowed: true, retryAfter: 0 }))
    .mockResolvedValueOnce(Response.json({ allowed: false, retryAfter: 1 }));
  expect((await app.request("https://example.com/api/trpc/order.list")).status).toBe(429);
  expect(authenticate).toHaveBeenCalledOnce();
});
it("本番で制限基盤が停止した場合は503で拒否する", async () => {
  mocks.env.REQUEST_THROTTLE = undefined;
  expect((await app.request("https://example.com/api/trpc/order.list")).status).toBe(503);
  expect(authenticate).not.toHaveBeenCalled();
});
it("21件のバッチは本人確認前に拒否する", async () => {
  expect(
    (
      await app.request(
        `https://example.com/api/trpc/${Array(21).fill("order.list").join(",")}?batch=1`,
      )
    ).status,
  ).toBe(400);
  expect(authenticate).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("符号化されたカンマも復号して全操作を本人枠へ計上する", async () => {
  await app.request("https://example.com/api/trpc/order.list%2Cproduct.list?batch=1");
  expect(JSON.parse(mocks.fetch.mock.calls[1]![1].body)).toEqual({ scope: "subject", cost: 2 });
});
