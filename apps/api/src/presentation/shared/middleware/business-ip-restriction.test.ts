import { beforeEach, expect, it, vi } from "vite-plus/test";
import { Hono } from "hono";
import type { Context } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import { authenticateRequest } from "#api/presentation/shared/middleware/authentication.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import { createTrpcContext, t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  requirePermissions,
  serviceSchema,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn<ServiceIdentityProvider["authenticate"]>(),
  resolveActor: vi.fn<ServiceIdentityProvider["resolveActor"]>(),
  authorize: vi.fn<ServiceIdentityProvider["authorize"]>(),
  assertBusinessIp: vi.fn<(scope: string, ip: string | null) => Promise<void>>(),
  ordinary: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { APP_ENV: "local" } }));
vi.mock("#api/composition-root.ts", () => ({
  createContainer: () => ({
    identityProvider: mocks,
    access: { assertBusinessIp: mocks.assertBusinessIp },
  }),
}));
const router = t.router({
  scoped: procedure
    .use(requireActor(ACCOUNT_CATEGORIES))
    .use(requireBusinessIp)
    .use(requirePermissions([]))
    .input(serviceSchema)
    .query((props) => mocks.ordinary(props.ctx.actor.channel)),
  resolveOnly: procedure.use(requireActor("business")).query(() => mocks.ordinary()),
  missingActor: procedure.use(requireBusinessIp).query(() => mocks.ordinary()),
});
const app = new Hono<RequestActorEnv>();
app.use(
  "/rpc/*",
  authenticateRequest,
  trpcServer({
    endpoint: "/rpc",
    router,
    createContext: (options, context: Context<RequestActorEnv>) =>
      createTrpcContext(context.req.raw, options.info, context.var),
  }),
);

function request(path: string, input: unknown = { service: "business" }, headers?: HeadersInit) {
  return app.request(
    `http://127.0.0.1/rpc/${path}${path.includes("?") ? "&" : "?"}input=${encodeURIComponent(JSON.stringify(input))}`,
    { headers },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue({
    userId: "subject-1",
    tenantId: "",
    role: "member",
    permissions: [],
  });
  mocks.resolveActor.mockImplementation(async (identity, selection) => ({
    ...identity,
    channel: selection.service === "operator" ? "admin" : selection.service,
    tenantId: "org-1",
  }));
  mocks.assertBusinessIp.mockResolvedValue(undefined);
  mocks.authorize.mockImplementation(async (identity) => ({
    identity,
    permissions: [],
    protectedRole: false,
    platform: identity.channel === "admin",
  }));
  mocks.ordinary.mockResolvedValue({ ok: true });
});
it("企業IP制限の専用ミドルウェア / 会員解決だけではIP検査を実行しない", async () => {
  expect((await request("resolveOnly")).status).toBe(200);
  expect(mocks.resolveActor).toHaveBeenCalledOnce();
  expect(mocks.assertBusinessIp).not.toHaveBeenCalled();
});
it("企業IP制限の専用ミドルウェア / 解決した企業とCloudflare接続元を検査してから権限・業務へ進む", async () => {
  expect(
    (
      await request("scoped", undefined, {
        "cf-connecting-ip": "203.0.113.5",
        "x-forwarded-for": "198.51.100.1",
      })
    ).status,
  ).toBe(200);
  expect(mocks.assertBusinessIp).toHaveBeenCalledExactlyOnceWith({
    scope: "org-1",
    clientIp: "203.0.113.5",
  });
  expect(mocks.resolveActor.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.assertBusinessIp.mock.invocationCallOrder[0] ?? 0,
  );
  expect(mocks.assertBusinessIp.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.authorize.mock.invocationCallOrder[0] ?? 0,
  );
});
it("企業IP制限の専用ミドルウェア / 接続元不明も検査へ渡し、拒否時は業務を実行しない", async () => {
  mocks.assertBusinessIp.mockRejectedValue(
    new ApplicationError({
      code: "FORBIDDEN",
      message: "このIPアドレスからは企業画面を利用できません",
    }),
  );
  expect((await request("scoped", undefined, { "x-forwarded-for": "203.0.113.5" })).status).toBe(
    403,
  );
  expect(mocks.assertBusinessIp).toHaveBeenCalledExactlyOnceWith({
    scope: "org-1",
    clientIp: null,
  });
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it.each(["customer", "operator"])(
  "企業IP制限の専用ミドルウェア / %s会員は企業のIP制限を適用しない",
  async (service) => {
    expect((await request("scoped", { service })).status).toBe(200);
    expect(mocks.assertBusinessIp).not.toHaveBeenCalled();
  },
);
it("企業IP制限の専用ミドルウェア / 企業未選択の本人操作は企業IP設定を照会しない", async () => {
  mocks.resolveActor.mockResolvedValue({
    userId: "user-1",
    channel: "business",
    tenantId: "",
    role: "member",
    permissions: [],
  });
  expect((await request("scoped")).status).toBe(200);
  expect(mocks.assertBusinessIp).not.toHaveBeenCalled();
});
it("企業IP制限の専用ミドルウェア / 会員ガードがない接続は安全側で拒否する", async () => {
  expect((await request("missingActor")).status).toBe(403);
  expect(mocks.assertBusinessIp).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("企業IP制限の専用ミドルウェア / 混在バッチで企業操作を拒否しても顧客操作は実行できる", async () => {
  mocks.assertBusinessIp.mockRejectedValue(
    new ApplicationError({
      code: "FORBIDDEN",
      message: "このIPアドレスからは企業画面を利用できません",
    }),
  );
  const response = await request("scoped,scoped?batch=1", {
    0: { service: "business" },
    1: { service: "customer" },
  });
  expect(response.status).toBe(207);
  expect(await response.json()).toEqual([
    { error: expect.objectContaining({ data: expect.objectContaining({ code: "FORBIDDEN" }) }) },
    { result: { data: { ok: true } } },
  ]);
  expect(mocks.assertBusinessIp).toHaveBeenCalledExactlyOnceWith({
    scope: "org-1",
    clientIp: null,
  });
  expect(mocks.ordinary).toHaveBeenCalledExactlyOnceWith("customer");
});
