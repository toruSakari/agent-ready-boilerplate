import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { Hono } from "hono";
import type { Context } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { authenticateRequest } from "#api/presentation/shared/middleware/authentication.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import { t, procedure, createTrpcContext } from "#api/presentation/shared/trpc-core.ts";
import { requireActor } from "#api/presentation/shared/middleware/trpc-authorization.ts";
import {
  requireAccessPermissions,
  requireAccessScope,
  scopedInput,
} from "#api/presentation/access/middleware/trpc-authorization.ts";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn<ServiceIdentityProvider["authenticate"]>(),
  resolveActor: vi.fn<ServiceIdentityProvider["resolveActor"]>(),
  authorize: vi.fn<ServiceIdentityProvider["authorize"]>(),
  load: vi.fn<AccessRepository["load"]>(),
  ordinary: vi.fn(),
}));
vi.mock("#api/composition-root.ts", () => ({
  createContainer: () => ({
    access: { assertBusinessIp: async () => {} },
    identityProvider: mocks,
    accessRepository: { load: mocks.load },
  }),
}));
const router = t.router({
  selectedScope: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["member.read"]))
    .query((props) => mocks.ordinary(props.ctx.actor.accessSnapshot)),
  missingScopeActor: procedure
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["member.read"]))
    .query(() => mocks.ordinary()),
  scoped: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requireAccessPermissions(["member.read"], "org-1"))
    .query((props) => mocks.ordinary(props.ctx.actor.accessSnapshot?.state)),
  missingActor: procedure
    .use(requireAccessPermissions(["member.read"], "org-1"))
    .query(() => mocks.ordinary()),
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

function request(path: string) {
  return app.request(`https://example.com/rpc/${path}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue({
    userId: "u1",
    tenantId: "",
    role: "member",
    permissions: [],
  });
  mocks.resolveActor.mockResolvedValue({
    userId: "business:u1",
    tenantId: "org-1",
    channel: "business",
    role: "member",
    permissions: [],
  });
  mocks.authorize.mockImplementation(async (identity, required) => ({
    identity,
    permissions: required,
    protectedRole: false,
    platform: false,
  }));
  mocks.load.mockResolvedValue({
    version: 7,
    organizations: [],
    customerAccounts: [],
    businessAccounts: [],
    operatorAccounts: [],
    roles: [],
    memberships: [],
    invitations: [],
  });
  mocks.ordinary.mockResolvedValue({ ok: true });
});
describe("アクセス状態のスナップショットと認可の実行順序", () => {
  it("現在の権限を確認する前に状態を読み込み、同じ版を業務処理へ渡す", async () => {
    const response = await request("scoped");
    expect(response.status).toBe(200);
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith("org-1");
    expect(mocks.load.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.authorize.mock.invocationCallOrder[0]!,
    );
    expect(mocks.authorize.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.ordinary.mock.invocationCallOrder[0]!,
    );
    expect(mocks.ordinary).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ version: 7 }));
  });
  it("スナップショット取得後に権限が失効した場合は業務処理を実行せず拒否する", async () => {
    mocks.load.mockImplementationOnce(async () => {
      mocks.authorize.mockRejectedValue(
        new ApplicationError({ code: "FORBIDDEN", message: "権限が失効しました" }),
      );
      return {
        version: 7,
        organizations: [],
        customerAccounts: [],
        businessAccounts: [],
        operatorAccounts: [],
        roles: [],
        memberships: [],
        invitations: [],
      };
    });
    const response = await request("scoped");
    expect(response.status).toBe(403);
    expect(mocks.ordinary).not.toHaveBeenCalled();
  });
});

it("会員ガードの接続漏れは状態の読み込み前に拒否する", async () => {
  const response = await request("missingActor");
  expect(response.status).toBe(403);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});

describe("Accessの対象範囲を状態取得前に限定する", () => {
  const selected = (scope: string, path = "selectedScope") =>
    request(`${path}?input=${encodeURIComponent(JSON.stringify({ service: "business", scope }))}`);
  it("所属企業だけを読み込み、取得時点の版を認可済みactorへ渡す", async () => {
    expect((await selected("org-1")).status).toBe(200);
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith("org-1");
    expect(mocks.ordinary).toHaveBeenCalledExactlyOnceWith({
      scope: "org-1",
      state: expect.objectContaining({ version: 7 }),
    });
  });
  it.each(["org-2", "platform"])(
    "企業会員は対象%sの状態取得・権限照会を開始できない",
    async (scope) => {
      expect((await selected(scope)).status).toBe(403);
      expect(mocks.load).not.toHaveBeenCalled();
      expect(mocks.authorize).not.toHaveBeenCalled();
      expect(mocks.ordinary).not.toHaveBeenCalled();
    },
  );
  it("会員ガードの接続漏れも状態取得前に拒否する", async () => {
    expect((await selected("org-1", "missingScopeActor")).status).toBe(403);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.ordinary).not.toHaveBeenCalled();
  });
  it("不正なscopeは入力検証で止まり、状態取得・権限照会をしない", async () => {
    expect((await selected("")).status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.ordinary).not.toHaveBeenCalled();
  });
});
