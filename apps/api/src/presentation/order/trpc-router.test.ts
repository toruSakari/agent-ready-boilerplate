import { BUSINESS_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import { z } from "zod";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { Hono } from "hono";
import type { Context } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { authenticateRequest } from "#api/presentation/shared/middleware/authentication.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import { appRouter } from "#api/presentation/app-router.ts";
import { createTrpcContext } from "#api/presentation/shared/trpc-core.ts";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  resolveActor: vi.fn(),
  authorize: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("#api/composition-root.ts", () => ({
  createContainer: () => ({
    access: { assertBusinessIp: async () => {} },
    identityProvider: {
      authenticate: mocks.authenticate,
      resolveActor: mocks.resolveActor,
      authorize: mocks.authorize,
    },
    createOrder: { execute: mocks.execute },
    listOrders: { execute: mocks.execute },
    manageOrder: { execute: mocks.execute },
  }),
}));

async function errorBody(response: Response) {
  return z
    .object({ error: z.object({ message: z.string(), data: z.record(z.string(), z.unknown()) }) })
    .parse(await response.json());
}

// Honoの本人確認からHTTPアダプターまで通し、業務コードのステータス・公開文言への変換を測る。
const app = new Hono<RequestActorEnv>();
app.use(
  "/api/trpc/*",
  authenticateRequest,
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext: (options, context: Context<RequestActorEnv>) =>
      createTrpcContext(context.req.raw, options.info, context.var),
  }),
);

function request(path: string, body?: string) {
  return app.request(`https://example.com/api/trpc/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue({
    userId: "u1",
    tenantId: "t1",
    role: "admin",
    permissions: BUSINESS_PERMISSIONS,
  });
  mocks.resolveActor.mockImplementation(async (actor, selection) => ({
    ...actor,
    channel: selection.service === "operator" ? "admin" : selection.service,
  }));
  mocks.authorize.mockImplementation(async (identity, required) => ({
    identity,
    permissions: required,
    protectedRole: true,
    platform: false,
  }));
  mocks.execute.mockResolvedValue([]);
});

it.each([
  ["BAD_REQUEST", 400, "数量が不正です"],
  ["PAYLOAD_TOO_LARGE", 413, "画像は5MB以下にしてください"],
  ["UNAUTHORIZED", 401, "認証が必要です。ログインし直してください"],
  ["FORBIDDEN", 403, "この操作を行う権限がありません"],
  ["NOT_FOUND", 404, "対象のデータが見つかりません"],
  ["CONFLICT", 409, "在庫が不足しています"],
] as const)("tRPCのHTTPエラー応答 / %sをHTTP %sと日本語で返す", async (code, status, message) => {
  const error = new ApplicationError({ code, message });
  if (code === "UNAUTHORIZED") {
    mocks.authenticate.mockRejectedValue(error);
  } else {
    mocks.execute.mockRejectedValue(error);
  }

  const response = await request(
    `order.list?input=${encodeURIComponent(JSON.stringify({ service: "business" }))}`,
  );
  expect(response.status).toBe(status);
  const body = await errorBody(response);
  expect(body.error.message).toBe(message);
  expect(body.error.data.code).toBe(code);
  expect(body.error.data).not.toHaveProperty("stack");
});

it("tRPCのHTTPエラー応答 / 入力不備は400になり、保存処理を呼ばない", async () => {
  const response = await request(
    "order.create",
    JSON.stringify({ service: "customer", lines: [] }),
  );
  expect(response.status).toBe(400);
  const body = await errorBody(response);
  expect(body.error.message).toBe("入力内容が不正です。入力内容を確認してください");
  expect(mocks.execute).not.toHaveBeenCalled();
});

it("tRPCのHTTPエラー応答 / 不正なJSONを400と日本語で返す", async () => {
  const response = await request("order.create", "{");
  expect(response.status).toBe(400);
  expect((await errorBody(response)).error.message).toBe(
    "入力内容が不正です。入力内容を確認してください",
  );
});

it("tRPCのHTTPエラー応答 / 予期しないエラーは500で、内部情報を公開しない", async () => {
  mocks.execute.mockRejectedValue(new Error("秘密のDB接続情報 token=private"));
  const response = await request(
    `order.list?input=${encodeURIComponent(JSON.stringify({ service: "business" }))}`,
  );
  expect(response.status).toBe(500);
  const body = await errorBody(response);
  expect(body.error.message).toBe("処理に失敗しました。しばらくしてから再試行してください");
  expect(JSON.stringify(body)).not.toContain("private");
  expect(body.error.data).not.toHaveProperty("stack");
});

it("tRPCのHTTPエラー応答 / 存在しないプロシージャは404と日本語で返す", async () => {
  const response = await request("missing");
  expect(response.status).toBe(404);
  expect((await errorBody(response)).error.message).toBe("対象のデータが見つかりません");
});

it("注文管理APIのHTTP応答 / 更新番号が不正な編集入力を400で拒否する", async () => {
  const response = await request(
    "order.update",
    JSON.stringify({
      service: "business",
      id: "o1",
      version: -1,
      lines: [{ sku: "s1", name: "商品", quantity: 1, unitPrice: 100 }],
    }),
  );
  expect(response.status).toBe(400);
  expect((await errorBody(response)).error.message).toBe(
    "入力内容が不正です。入力内容を確認してください",
  );
  expect(mocks.execute).not.toHaveBeenCalled();
});

it("注文管理APIのHTTP応答 / 禁止された遷移は409と日本語文言になる", async () => {
  mocks.execute.mockRejectedValue(
    new ApplicationError({ code: "CONFLICT", message: "この注文の状態からは変更できません" }),
  );
  const response = await request(
    "order.transition",
    JSON.stringify({ service: "business", id: "o1", version: 1, status: "cancelled" }),
  );
  expect(response.status).toBe(409);
  expect((await errorBody(response)).error.message).toBe("この注文の状態からは変更できません");
});

it("注文管理APIのHTTP応答 / 下書きへの逆戻り入力は400で拒否する", async () => {
  const response = await request(
    "order.transition",
    JSON.stringify({ service: "business", id: "o1", version: 1, status: "draft" }),
  );
  expect(response.status).toBe(400);
  expect(mocks.execute).not.toHaveBeenCalled();
});

it("企業会員は注文作成を拒否し、会員解決・権限照会・保存に進まない", async () => {
  const response = await request(
    "order.create",
    JSON.stringify({
      service: "business",
      draft: true,
      lines: [{ sku: "s1", name: "代理注文", quantity: 1, unitPrice: 100 }],
    }),
  );
  expect(response.status).toBe(403);
  expect((await errorBody(response)).error.data.code).toBe("FORBIDDEN");
  expect(mocks.resolveActor).not.toHaveBeenCalled();
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.execute).not.toHaveBeenCalled();
});
