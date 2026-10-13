import { beforeEach, expect, it, vi } from "vite-plus/test";
import { Hono } from "hono";
import type { Context } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { storeRouter } from "#api/presentation/store/trpc-router.ts";
import { t, createTrpcContext } from "#api/presentation/shared/trpc-core.ts";
import { authenticateRequest } from "#api/presentation/shared/middleware/authentication.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  resolveActor: vi.fn(),
  authorize: vi.fn(),
  list: vi.fn(),
  checkout: vi.fn(),
  cancelOrder: vi.fn(),
  listOrders: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { APP_ENV: "local" } }));
vi.mock("#api/composition-root.ts", () => ({
  createContainer: () => ({
    identityProvider: {
      authenticate: mocks.authenticate,
      resolveActor: mocks.resolveActor,
      authorize: mocks.authorize,
    },
    store: {
      list: mocks.list,
      checkout: mocks.checkout,
      cancelOrder: mocks.cancelOrder,
      listOrders: mocks.listOrders,
    },
  }),
}));
const app = new Hono<RequestActorEnv>();
app.use(
  "/rpc/*",
  authenticateRequest,
  trpcServer({
    endpoint: "/rpc",
    router: t.router({ store: storeRouter }),
    createContext: (options, context: Context<RequestActorEnv>) =>
      createTrpcContext(context.req.raw, options.info, context.var),
  }),
);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockRejectedValue(
    new ApplicationError({ code: "UNAUTHORIZED", message: "認証が必要です" }),
  );
  mocks.list.mockResolvedValue({ items: [], nextCursor: null });
});
it("公開ストア認証境界 / 未登録会員の取消を拒否する", async () => {
  mocks.authenticate.mockResolvedValue({
    userId: "subject",
    tenantId: "",
    role: "member",
    permissions: [],
  });
  mocks.resolveActor.mockRejectedValue(
    new ApplicationError({ code: "FORBIDDEN", message: "通常会員の登録が必要です" }),
  );
  const response = await app.request("http://api.test/rpc/store.cancelOrder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "order", version: 0 }),
  });
  expect(response.status).toBe(403);
  expect(mocks.cancelOrder).not.toHaveBeenCalled();
});

it("公開ストア認証境界 / 未認証の注文取消を拒否する", async () => {
  const response = await app.request("http://api.test/rpc/store.cancelOrder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "order", version: 0 }),
  });
  expect(response.status).toBe(401);
  expect(mocks.cancelOrder).not.toHaveBeenCalled();
});

it("公開ストア認証境界 / 取消入力で販売企業を改ざんできない", async () => {
  const source = { userId: "subject", tenantId: "", role: "member", permissions: [] };
  const identity = { ...source, userId: "customer:buyer", channel: "customer" };
  mocks.authenticate.mockResolvedValue(source);
  mocks.resolveActor.mockResolvedValue(identity);
  mocks.authorize.mockResolvedValue({
    identity,
    permissions: [],
    protectedRole: false,
    platform: false,
  });
  const response = await app.request("http://api.test/rpc/store.cancelOrder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "order", version: 0, tenantId: "another-seller" }),
  });
  expect(response.status).toBe(400);
  expect(mocks.cancelOrder).not.toHaveBeenCalled();
});

it("公開ストア認証境界 / 未認証でも明示した公開商品一覧を閲覧可能", async () => {
  const response = await app.request(
    "http://api.test/rpc/store.list?input=" + encodeURIComponent(JSON.stringify({ limit: 25 })),
  );
  expect(response.status).toBe(200);
  expect(mocks.list).toHaveBeenCalledOnce();
  expect(mocks.resolveActor).not.toHaveBeenCalled();
});

it("公開ストア認証境界 / 未認証では本人注文履歴を拒否する", async () => {
  const response = await app.request(
    "http://api.test/rpc/store.listOrders?input=" +
      encodeURIComponent(JSON.stringify({ limit: 25 })),
  );
  expect(response.status).toBe(401);
  expect(mocks.listOrders).not.toHaveBeenCalled();
});

it("公開ストア認証境界 / 公開と本人操作の混在バッチで認証を回避できない", async () => {
  const response = await app.request(
    "http://api.test/rpc/store.list,store.listOrders?batch=1&input=" +
      encodeURIComponent(JSON.stringify({ 0: { limit: 25 }, 1: { limit: 25 } })),
  );
  expect(response.status).toBe(401);
  expect(mocks.listOrders).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
});

it("公開ストア認証境界 / 企業ヘッダーを無視し企業所属なしのcustomerを解決する", async () => {
  const source = { userId: "subject", tenantId: "", role: "member", permissions: [] };
  const identity = { ...source, userId: "customer:buyer", channel: "customer" };
  mocks.authenticate.mockResolvedValue(source);
  mocks.resolveActor.mockResolvedValue(identity);
  mocks.authorize.mockResolvedValue({
    identity,
    permissions: [],
    protectedRole: false,
    platform: false,
  });
  mocks.listOrders.mockResolvedValue({ items: [], nextCursor: null });
  const response = await app.request(
    "http://api.test/rpc/store.listOrders?input=" +
      encodeURIComponent(JSON.stringify({ limit: 25 })),
    { headers: { "x-organization-id": "unrelated-seller" } },
  );
  expect(response.status).toBe(200);
  expect(mocks.resolveActor).toHaveBeenCalledWith(source, { service: "customer" }, "");
  expect(mocks.authorize).toHaveBeenCalledWith(identity, []);
});
