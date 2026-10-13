import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";
import { z } from "zod";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { Hono } from "hono";
import type { Context } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { authenticateRequest } from "#api/presentation/shared/middleware/authentication.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import { createTrpcContext, procedure, t } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  serviceSchema,
  requirePermissions,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";

const mocks = vi.hoisted(() => ({
  provider: undefined as ServiceIdentityProvider | undefined,
  authenticate: vi.fn<ServiceIdentityProvider["authenticate"]>(),
  resolveActor: vi.fn<ServiceIdentityProvider["resolveActor"]>(),
  authorize: vi.fn<ServiceIdentityProvider["authorize"]>(),
  standalone: vi.fn(),
  ordinary: vi.fn(),
  assertBusinessIp: vi.fn<(scope: string, ip: string | null) => Promise<void>>(),
}));
vi.mock("cloudflare:workers", () => ({ env: { APP_ENV: "local" } }));
vi.mock("#api/composition-root.ts", () => ({
  createContainer: () => ({
    access: { assertBusinessIp: mocks.assertBusinessIp },
    identityProvider: mocks.provider ?? {
      authenticate: mocks.authenticate,
      resolveActor: mocks.resolveActor,
      authorize: mocks.authorize,
    },
  }),
}));
const router = t.router({
  copiedActor: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(async (props) => props.next({ ctx: { actor: { ...props.ctx.actor } } }))
    .use(requirePermissions(["product.update"]))
    .mutation((props) => mocks.ordinary(props.ctx.actor)),
  fixedBusiness: procedure
    .input(z.object({ service: z.string().optional() }))
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.update"]))
    .mutation((props) => mocks.ordinary(props.ctx.actor)),
  selectedActor: procedure
    .input(z.object({ service: z.string().optional() }))
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read"]))
    .mutation((props) => mocks.ordinary(props.ctx.actor)),
  permissions: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["order:read", "order:create"]))
    .input(z.object({ service: z.enum(["customer", "business"]) }))
    .mutation((props) => mocks.ordinary(props.ctx.actor)),
  missingIdentity: procedure
    .use(requirePermissions(["order:read"]))
    .mutation(() => mocks.ordinary()),
  emptyPermissions: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions([]))
    .input(z.object({ service: z.enum(["customer", "business"]) }))
    .mutation((props) => mocks.ordinary(props.ctx.actor)),
  renamedLifecycle: procedure
    .use(requireActor(ACCOUNT_CATEGORIES, { purpose: "registration" }))
    .use(requirePermissions([]))
    .meta({ standalone: true })
    .input(serviceSchema)
    .mutation((props) => mocks.standalone(props.ctx.actor)),
  ordinary: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .input(z.object({ service: z.enum(["customer", "business"]) }))
    .mutation((props) => mocks.ordinary(props.ctx.actor)),
  operator: procedure
    .use(requireActor("operator"))
    .query((props) => mocks.ordinary(props.ctx.actor)),
});
// 本番と異なるマウント先・手続き名でも認可宣言が効くよう、URLを意図的に変える。
const app = new Hono<RequestActorEnv>();
app.use(
  "/unrelated-rpc/*",
  authenticateRequest,
  trpcServer({
    endpoint: "/unrelated-rpc",
    router,
    createContext: (options, context: Context<RequestActorEnv>) =>
      createTrpcContext(context.req.raw, options.info, context.var),
  }),
);

function request(path: string, input?: unknown) {
  return app.request(`https://example.com/unrelated-rpc/${path}`, {
    method: input === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.provider = undefined;
  mocks.assertBusinessIp.mockResolvedValue(undefined);
  mocks.authenticate.mockResolvedValue({
    userId: "user-1",
    subjectId: "user-1",
    tenantId: "",
    role: "member",
    permissions: [],
  });
  mocks.resolveActor.mockImplementation(async (_request, actor) => ({
    userId: `${actor.service}:user-1`,
    subjectId: "user-1",
    channel: actor.service === "operator" ? "admin" : actor.service,
    tenantId: "org-1",
    role: "member",
    permissions: [],
  }));
  mocks.authorize.mockImplementation(async (identity, required) => ({
    identity,
    permissions: required,
    protectedRole: false,
    platform: identity.channel === "admin",
    purpose: mocks.resolveActor.mock.lastCall?.[1].purpose,
  }));
  mocks.standalone.mockResolvedValue({ ok: true });
  mocks.ordinary.mockResolvedValue({ ok: true });
});
it.each(["renamedLifecycle,ordinary", "ordinary,renamedLifecycle"])(
  "RPC認可はURL文字列ではなく手続きの宣言を使う / 別名のライフサイクル%sも全操作の開始前にバッチを拒否する",
  async (procedures) => {
    const response = await request(`${procedures}?batch=1`, {
      0: { service: "customer" },
      1: { service: "business" },
    });
    expect(response.status).toBe(400);
    expect(mocks.authenticate).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
    expect(mocks.resolveActor).not.toHaveBeenCalled();
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.standalone).not.toHaveBeenCalled();
    expect(mocks.ordinary).not.toHaveBeenCalled();
  },
);
it("RPC認可はURL文字列ではなく手続きの宣言を使う / 別名の単独ライフサイクルは宣言された目的を認証プロバイダーへ渡す", async () => {
  const response = await request("renamedLifecycle", { service: "customer" });
  expect(response.status).toBe(200);
  expect(mocks.resolveActor).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ subjectId: "user-1" }),
    {
      service: "customer",
      purpose: "registration",
    },
    "",
  );
  expect(mocks.standalone).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ userId: "customer:user-1", channel: "customer" }),
  );
});
it("RPC認可はURL文字列ではなく手続きの宣言を使う / 一件だけのバッチはライフサイクルの単独実行を維持する", async () => {
  const response = await request("renamedLifecycle?batch=1", { 0: { service: "business" } });
  expect(response.status).toBe(200);
  expect(mocks.resolveActor).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ subjectId: "user-1" }),
    {
      service: "business",
      purpose: "registration",
    },
    "",
  );
  expect(mocks.standalone).toHaveBeenCalledOnce();
});
it("RPC認可はURL文字列ではなく手続きの宣言を使う / 通常の別名手続きはURLに関係なく入力のサービスだけを選択する", async () => {
  const response = await request("ordinary", { service: "business" });
  expect(response.status).toBe(200);
  expect(mocks.resolveActor).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ subjectId: "user-1" }),
    {
      service: "business",
    },
    "",
  );
});
it("RPC認可はURL文字列ではなく手続きの宣言を使う / 運営手続きは別のURLへマウントしてもAccessなしで会員解決しない", async () => {
  const response = await request("operator");
  expect(response.status).toBe(403);
  expect(mocks.authenticate).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
  expect(mocks.resolveActor).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("会員解決と要求権限を組み合わせるミドルウェア / 選択された会員とすべての要求権限を認可プロバイダーへ渡してから処理する", async () => {
  const response = await request("permissions", { service: "business" });
  expect(response.status).toBe(200);
  expect(mocks.authorize).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ userId: "business:user-1", channel: "business" }),
    ["order:read", "order:create"],
  );
  expect(mocks.authenticate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.authorize.mock.invocationCallOrder[0],
  );
  expect(mocks.authorize.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.ordinary.mock.invocationCallOrder[0],
  );
});
it("会員解決と要求権限を組み合わせるミドルウェア / 権限ガードを会員解決の前に置くと認可も処理も開始しない", async () => {
  const response = await request("missingIdentity", {});
  expect(response.status).toBe(403);
  expect(mocks.authenticate).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
  expect(mocks.resolveActor).not.toHaveBeenCalled();
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("会員解決と要求権限を組み合わせるミドルウェア / 要求権限の拒否を403へ変換し処理を開始しない", async () => {
  mocks.authorize.mockRejectedValue(
    new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" }),
  );
  const response = await request("permissions", { service: "customer" });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: expect.objectContaining({
      message: "この操作を行う権限がありません",
      data: expect.objectContaining({ code: "FORBIDDEN" }),
    }),
  });
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("会員解決と要求権限を組み合わせるミドルウェア / 会員認証に失敗した場合は権限ガードにも処理にも進まない", async () => {
  mocks.resolveActor.mockRejectedValue(
    new ApplicationError({ code: "FORBIDDEN", message: "会員登録が必要です" }),
  );
  const response = await request("permissions", { service: "business" });
  expect(response.status).toBe(403);
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("会員解決と要求権限を組み合わせるミドルウェア / 空の権限配列も認可プロバイダーの会員再確認を省略しない", async () => {
  const response = await request("emptyPermissions", { service: "business" });
  expect(response.status).toBe(200);
  expect(mocks.authorize).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ userId: "business:user-1" }),
    [],
  );
});
it("requireActorをuseで合成する / 固定した企業会員ガードを呼び出し元のserviceで運営へ変更できない", async () => {
  const response = await request("fixedBusiness", { service: "operator" });
  expect(response.status).toBe(200);
  expect(mocks.resolveActor).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ subjectId: "user-1" }),
    {
      service: "business",
    },
    "",
  );
  expect(mocks.authorize).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ userId: "business:user-1", channel: "business" }),
    ["product.update"],
  );
  expect(mocks.authenticate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.authorize.mock.invocationCallOrder[0]!,
  );
  expect(mocks.authorize.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.ordinary.mock.invocationCallOrder[0]!,
  );
});
it.each(["customer", "business"])(
  "requireActorをuseで合成する / 共有ガードで選択した%sの会員を確認する",
  async (service) => {
    const response = await request("selectedActor", { service });
    expect(response.status).toBe(200);
    expect(mocks.resolveActor).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ subjectId: "user-1" }),
      { service },
      "",
    );
    expect(mocks.ordinary).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ channel: service }),
    );
  },
);
it.each([{}, { service: "unknown" }])(
  "requireActorをuseで合成する / 許可した会員種別以外の入力%jは会員確認の前に拒否する",
  async (input) => {
    const response = await request("selectedActor", input);
    expect(response.status).toBe(400);
    expect(mocks.authenticate).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
    expect(mocks.resolveActor).not.toHaveBeenCalled();
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.ordinary).not.toHaveBeenCalled();
  },
);
it("requireActorをuseで合成する / 固定した会員種別で未登録なら権限ガードにも処理にも進まない", async () => {
  mocks.resolveActor.mockRejectedValue(
    new ApplicationError({ code: "FORBIDDEN", message: "企業会員の登録が必要です" }),
  );
  const response = await request("fixedBusiness", {});
  expect(response.status).toBe(403);
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it.each(["UNAUTHORIZED", "FORBIDDEN"] as const)(
  "本人確認と会員種別の拒否境界 / 本人確認の%sもHonoのJSONではなくtRPCのエラー形式を保つ",
  async (code) => {
    mocks.authenticate.mockRejectedValue(new ApplicationError({ code, message: "認証できません" }));
    const response = await request("permissions", { service: "business" });
    expect(response.status).toBe(code === "UNAUTHORIZED" ? 401 : 403);
    expect(await response.json()).toEqual({
      error: expect.objectContaining({
        message: "認証できません",
        data: expect.objectContaining({ code, httpStatus: response.status }),
      }),
    });
    expect(mocks.resolveActor).not.toHaveBeenCalled();
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.ordinary).not.toHaveBeenCalled();
  },
);
it.each(["customer", "admin", undefined] as const)(
  "本人確認と会員種別の拒否境界 / プロバイダーが固定businessと異なる%sを返すと権限照会の前に403にする",
  async (channel) => {
    mocks.resolveActor.mockResolvedValue({
      userId: "wrong-account",
      tenantId: "org-1",
      role: "admin",
      channel,
      permissions: ["product.update"],
    });
    const response = await request("fixedBusiness", { service: "business" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: expect.objectContaining({
        data: expect.objectContaining({ code: "FORBIDDEN" }),
      }),
    });
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.ordinary).not.toHaveBeenCalled();
  },
);
it("本人確認と会員種別の拒否境界 / 有効な種別でも共有ガードの許可対象外なら400でなく403を返す", async () => {
  const response = await request("selectedActor", { service: "operator" });
  expect(response.status).toBe(403);
  expect(mocks.resolveActor).not.toHaveBeenCalled();
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("本人確認と会員種別の拒否境界 / Honoの本人確認を接続し忘れた場合も401のtRPC形式で拒否する", async () => {
  const unguarded = new Hono<RequestActorEnv>();
  unguarded.use(
    "/unverified/*",
    trpcServer({
      endpoint: "/unverified",
      router,
      createContext: (options, context: Context<RequestActorEnv>) =>
        createTrpcContext(context.req.raw, options.info, context.var),
    }),
  );
  const response = await unguarded.request("https://example.com/unverified/operator");
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({
    error: expect.objectContaining({
      data: expect.objectContaining({ code: "UNAUTHORIZED" }),
    }),
  });
  expect(mocks.authenticate).not.toHaveBeenCalled();
  expect(mocks.resolveActor).not.toHaveBeenCalled();
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("バッチ内での操作別actor分離 / 会員解決と認可が交差しても本人確認は一度で権限と処理結果は操作別になる", async () => {
  const customerResolved = Promise.withResolvers<void>();
  const businessAuthorized = Promise.withResolvers<void>();
  crossActorAuthorization(customerResolved, businessAuthorized);
  const response = await request("permissions,permissions?batch=1", {
    0: { service: "business" },
    1: { service: "customer" },
  });
  expect(response.status).toBe(207);
  expect(await response.json()).toEqual([
    { result: { data: { ok: true } } },
    { error: expect.objectContaining({ data: expect.objectContaining({ code: "FORBIDDEN" }) }) },
  ]);
  expect(mocks.authenticate).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
  expect(mocks.resolveActor).toHaveBeenCalledTimes(2);
  expect(mocks.resolveActor.mock.calls[0]?.[0]).toBe(mocks.resolveActor.mock.calls[1]?.[0]);
  expect(mocks.resolveActor.mock.calls[0]?.[0]).toMatchObject({ userId: "user-1", tenantId: "" });
  expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ channel: "customer" }), [
    "order:read",
    "order:create",
  ]);
  expect(mocks.authorize).toHaveBeenCalledWith(expect.objectContaining({ channel: "business" }), [
    "order:read",
    "order:create",
  ]);
  expect(mocks.ordinary).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      userId: "business:user-1",
      channel: "business",
      permissions: ["order:read", "order:create"],
    }),
  );
});

function useDatabaseProvider() {
  const access = {
    plans: vi.fn<AccessQuery["plans"]>(),
    plan: vi.fn<AccessQuery["plan"]>(),
    resolveAccount: vi
      .fn<AccessQuery["resolveAccount"]>()
      .mockResolvedValue({ id: "business:user-1", deleted: false }),
    isRegistered: vi.fn<AccessQuery["isRegistered"]>().mockResolvedValue(true),
    grant: vi.fn<AccessQuery["grant"]>(),
    invitationIsCurrent: vi.fn<AccessQuery["invitationIsCurrent"]>(),
    hasQualifiedOwner: vi.fn<AccessQuery["hasQualifiedOwner"]>(),
    qualified: vi.fn<AccessQuery["qualified"]>(),
    organizations: vi.fn<AccessQuery["organizations"]>(),
    audit: vi.fn<AccessQuery["audit"]>(),
  };
  const provider = new AccountIdentityProvider({ authenticate: mocks.authenticate }, access);
  mocks.provider = provider;
  return { access, authorize: vi.spyOn(provider, "authorize") };
}

it("Contextへ置くactorの発行元検証 / Honoの本人actorと同じ構造を持つコピーから会員を解決できない", async () => {
  const { access, authorize } = useDatabaseProvider();
  const forged = new Hono<RequestActorEnv>();
  forged.use(
    "/forged/*",
    authenticateRequest,
    async (context, next) => {
      context.set("actor", { ...context.var.actor! });
      await next();
    },
    trpcServer({
      endpoint: "/forged",
      router,
      createContext: (options, context: Context<RequestActorEnv>) =>
        createTrpcContext(context.req.raw, options.info, context.var),
    }),
  );
  const response = await forged.request("https://example.com/forged/fixedBusiness", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  expect(response.status).toBe(403);
  expect(access.resolveAccount).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
  expect(authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("Contextへ置くactorの発行元検証 / 会員ガード通過後にctx.actorをコピーしても実DBプロバイダーが権限付与を拒否する", async () => {
  const { access, authorize } = useDatabaseProvider();
  const response = await request("copiedActor", {});
  expect(response.status).toBe(403);
  expect(access.resolveAccount).toHaveBeenCalledExactlyOnceWith("user-1", "business");
  expect(authorize).toHaveBeenCalledOnce();
  expect(access.grant).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});
it("企業IP制限は各手続きの会員境界で検査する / 制限で拒否された企業操作は権限照会・業務本体へ進まない", async () => {
  mocks.assertBusinessIp.mockRejectedValue(
    new ApplicationError({
      code: "FORBIDDEN",
      message: "このIPアドレスからは企業画面を利用できません",
    }),
  );
  const response = await request("fixedBusiness", { service: "business" });
  expect(response.status).toBe(403);
  expect(mocks.assertBusinessIp).toHaveBeenCalledWith({ scope: "org-1", clientIp: null });
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.ordinary).not.toHaveBeenCalled();
});

function crossActorAuthorization(
  customerResolved: ReturnType<typeof Promise.withResolvers<void>>,
  businessAuthorized: ReturnType<typeof Promise.withResolvers<void>>,
) {
  mocks.resolveActor.mockImplementation(async (subject, selection) => {
    if (selection.service === "business") {
      await customerResolved.promise;
    } else {
      customerResolved.resolve();
    }

    return {
      ...subject,
      userId: `${selection.service}:user-1`,
      channel: selection.service === "operator" ? "admin" : selection.service,
      tenantId: "org-1",
    };
  });
  mocks.authorize.mockImplementation(async (identity, required) => {
    if (identity.channel === "customer") {
      await businessAuthorized.promise;
      throw new ApplicationError({ code: "FORBIDDEN", message: "注文作成権限がありません" });
    }

    businessAuthorized.resolve();
    return { identity, permissions: required, protectedRole: false, platform: false };
  });
}
