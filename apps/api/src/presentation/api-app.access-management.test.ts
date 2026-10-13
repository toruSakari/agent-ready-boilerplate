import {
  mocks,
  services,
  unavailableEndpoints,
  invitationInput,
  orderInput,
  productInput,
  request,
  query,
  expectNoServiceWork,
  revokeQualifications,
  operatorQueries,
  operatorMutations,
} from "#api/presentation/api-app.test-fixture.ts";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { expect, it } from "vite-plus/test";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import {
  BUSINESS_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";

it.each(["platform", "foreign-org"])(
  "プロシージャごとの会員・企業分離 / businessのロール保存も別スコープ%sの状態を読み込まない",
  async (scope) => {
    const response = await request(
      "/api/trpc/access.saveRole",
      { service: "business", scope, name: "担当者", permissions: [] },
      "http://localhost",
      { "x-organization-id": "org-1" },
    );
    expect(response.status).toBe(403);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.saveRole).not.toHaveBeenCalled();
  },
);
it.each([undefined, "", "x".repeat(ACCESS_LIMITS.idMaxLength + 1)])(
  "プロシージャごとの会員・企業分離 / scope入力%jの検証は読み取り・更新とも状態の読込より先に行う",
  async (scope) => {
    const input = { service: "business", scope };
    const headers = { "x-organization-id": "org-1" };
    const responses = [
      await query("access.members", input, "http://localhost", headers),
      await request(
        "/api/trpc/access.saveRole",
        { ...input, name: "担当者", permissions: [] },
        "http://localhost",
        headers,
      ),
    ];
    for (const response of responses) {
      expect(response.status).toBe(400);
    }

    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.listMembers).not.toHaveBeenCalled();
    expect(mocks.saveRole).not.toHaveBeenCalled();
  },
);
it("プロシージャごとの会員・企業分離 / businessのメンバー閲覧は認可された企業に限定する", async () => {
  const response = await query(
    "access.members",
    { service: "business", scope: "org-1" },
    "http://localhost",
    { "x-organization-id": "org-1" },
  );
  expect(response.status).toBe(200);
  expect(mocks.listMembers).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({ userId: "business:user-1", tenantId: "org-1" }),
    scope: "org-1",
  });
});
it.each([
  ["product.create", productInput, "product.update", mocks.createProduct],
  ["access.deleteUser", { userId: "customer:other" }, "user.delete", mocks.deleteUser],
  ["order.create", { ...orderInput, service: "customer" }, "order:create", mocks.createOrder],
  ["order.update", { ...orderInput, id: "order-1", version: 1 }, "order:update", mocks.manageOrder],
  ...(["confirmed", "cancelled", "shipped", "completed"] as const).map(
    (status) =>
      [
        "order.transition",
        { service: "business", id: "order-1", version: 1, status },
        "order:update",
        mocks.manageOrder,
      ] as const,
  ),
] as const)(
  "RPC操作権限が不足した場合の副作用境界 / %sは%sの入力でも%sがなければ業務本体へ進めない",
  async (procedure, input, permission, business) => {
    mocks.grant.mockImplementation(async (_userId, scope) => ({
      active: true,
      protectedRole: true,
      permissions: (scope === "platform" ? PLATFORM_PERMISSIONS : BUSINESS_PERMISSIONS).filter(
        (granted) => granted !== permission,
      ),
    }));
    const response = await request(`/api/trpc/${procedure}`, input, "http://localhost", {
      "x-organization-id": "org-1",
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: expect.objectContaining({ data: expect.objectContaining({ code: "FORBIDDEN" }) }),
    });
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(mocks.resolveAccount).toHaveBeenCalledOnce();
    expect(business).not.toHaveBeenCalled();
  },
);
it("共通RPC上の運営Cloudflare Access境界 / 企業管理権限だけではプランを割り当てられない", async () => {
  mocks.grant.mockResolvedValue({
    active: true,
    protectedRole: true,
    permissions: ["organization.manage"],
  });
  const response = await request("/api/trpc/access.assignPlan", {
    category: "business",
    id: "org-1",
    planCode: null,
  });
  expect(response.status).toBe(403);
  expect(mocks.assignPlan).not.toHaveBeenCalled();
});
it("共通RPC上の運営Cloudflare Access境界 / プラン割当は明示的な運営権限で実行する", async () => {
  mocks.assignPlan.mockResolvedValue(undefined);
  const input = { category: "business", id: "org-1", planCode: null };
  const response = await request("/api/trpc/access.assignPlan", input);
  expect(response.status).toBe(200);
  expect(mocks.assignPlan).toHaveBeenCalledWith({
    identity: expect.objectContaining({ channel: "admin", userId: "operator:user-1" }),
    input: input,
  });
});
it("共通RPC上の運営Cloudflare Access境界 / operatorを料金プランの割当先に指定できない", async () => {
  const response = await request("/api/trpc/access.assignPlan", {
    category: "operator",
    id: "operator:user-1",
    planCode: null,
  });
  expect(response.status).toBe(400);
  expect(mocks.assignPlan).not.toHaveBeenCalled();
});
it.each(operatorQueries)(
  "共通RPC上の運営Cloudflare Access境界 / 運営query %sはAccess認証なしで会員解決に進めない",
  async (procedure, input) => {
    const response = await query(procedure, input, "https://api.example.com");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: expect.objectContaining({
        message: "運営管理画面からアクセスしてください",
        data: expect.objectContaining({ code: "FORBIDDEN" }),
      }),
    });
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
    expect(mocks.resolveAccount).not.toHaveBeenCalled();
  },
);
it.each(operatorMutations)(
  "共通RPC上の運営Cloudflare Access境界 / 運営mutation %sはAccess認証なしで会員解決に進めない",
  async (procedure, input) => {
    const response = await request(`/api/trpc/${procedure}`, input, "https://api.example.com");
    expect(response.status).toBe(403);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
    expect(mocks.resolveAccount).not.toHaveBeenCalled();
  },
);
it.each([false, true])(
  "共通RPC上の運営Cloudflare Access境界 / 通常会員と運営の混在バッチでAccessを迂回できない（運営が先=%s）",
  async (operatorFirst) => {
    const procedures = operatorFirst
      ? "access.organizations,access.session"
      : "access.session,access.organizations";
    const inputs = operatorFirst ? [{}, { service: "customer" }] : [{ service: "customer" }, {}];
    const input = { 0: inputs[0], 1: inputs[1] };
    const response = await request(
      `/api/trpc/${procedures}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      undefined,
      "https://api.example.com",
    );
    expect(response.status).toBe(207);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    const denied = {
      error: expect.objectContaining({ data: expect.objectContaining({ code: "FORBIDDEN" }) }),
    };
    const allowed = { result: { data: { channel: "customer", accountId: "customer:user-1" } } };
    expect(await response.json()).toEqual(operatorFirst ? [denied, allowed] : [allowed, denied]);
    expect(mocks.resolveAccount).toHaveBeenCalledExactlyOnceWith("user-1", "customer");
    expect(mocks.listOrganizations).not.toHaveBeenCalled();
  },
);
it("共通RPC上の運営Cloudflare Access境界 / 管理操作のservice入力では固定のoperator会員を変更できない", async () => {
  const response = await query("access.organizations", { service: "business" });
  expect(response.status).toBe(200);
  expect(mocks.resolveAccount).toHaveBeenCalledExactlyOnceWith("user-1", "operator");
  expect(mocks.listOrganizations).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({ userId: "operator:user-1", channel: "admin" }),
  });
});
it.each(services)(
  "Hono経由の招待承諾例外 / %sの単独承諾は認証後・資格取得前に実行できる",
  async (service) => {
    revokeQualifications();
    const response = await request("/api/trpc/access.acceptInvitation", {
      service,
      ...invitationInput,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { data: { accepted: true } } });
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(mocks.acceptInvitation).toHaveBeenCalledExactlyOnceWith({
      identity: expect.objectContaining({
        userId: "",
        subjectId: "user-1",
        channel: service === "operator" ? "admin" : service,
      }),
      input: invitationInput,
    });
    expect(mocks.isRegistered).not.toHaveBeenCalled();
    expect(mocks.qualified).not.toHaveBeenCalled();
    expect(mocks.organizations).not.toHaveBeenCalled();
  },
);
it.each(services)("Hono経由の招待承諾例外 / %sの承諾でも本人認証を省略しない", async (service) => {
  mocks.authenticate.mockRejectedValue(
    new ApplicationError({ code: "UNAUTHORIZED", message: "ログインしてください" }),
  );
  const response = await request("/api/trpc/access.acceptInvitation", {
    service,
    ...invitationInput,
  });
  expect(response.status).toBe(401);
  expect(mocks.acceptInvitation).not.toHaveBeenCalled();
});
it.each(unavailableEndpoints)(
  "Hono経由の招待承諾例外 / 廃止された入口%sでは招待承諾も404にする",
  async (endpoint) => {
    revokeQualifications();
    const response = await request(`${endpoint}/access.acceptInvitation`, {
      service: "customer",
      ...invitationInput,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "APIが見つかりません", code: "NOT_FOUND" });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
  },
);
it.each(services)(
  "Hono経由のサービス登録・退会 / %sの登録状況は未登録でも認証済み主体を使って取得できる",
  async (service) => {
    revokeQualifications();
    const response = await query("access.registration", { service });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      result: { data: { registered: false, category: service, accountId: null } },
    });
    expect(mocks.registration).toHaveBeenCalledExactlyOnceWith({
      identity: expect.objectContaining({
        subjectId: "user-1",
        userId: "",
        channel: service === "operator" ? "admin" : service,
      }),
    });
    expect(mocks.isRegistered).not.toHaveBeenCalled();
  },
);
it("Hono経由のサービス登録・退会 / 顧客登録は未登録でも固定のcustomerとして実行する", async () => {
  revokeQualifications();
  const response = await request("/api/trpc/access.registerCustomer", {
    name: "登録する顧客",
    service: "operator",
  });
  expect(response.status).toBe(200);
  expect(mocks.resolveAccount).toHaveBeenCalledExactlyOnceWith("user-1", "customer");
  expect(mocks.registerCustomer).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({ subjectId: "user-1", userId: "", channel: "customer" }),
    input: { name: "登録する顧客" },
  });
  expect(mocks.isRegistered).not.toHaveBeenCalled();
});
it.each(services)(
  "Hono経由のサービス登録・退会 / %sの退会は対象サービスの会員IDを使い、企業ヘッダーを参照しない",
  async (service) => {
    const response = await request("/api/trpc/access.withdraw", { service }, "http://localhost", {
      "x-organization-id": "foreign-org",
    });
    expect(response.status).toBe(200);
    expect(mocks.withdraw).toHaveBeenCalledExactlyOnceWith({
      identity: expect.objectContaining({
        userId: `${service}:user-1`,
        subjectId: "user-1",
        tenantId: "",
      }),
    });
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(mocks.isRegistered).not.toHaveBeenCalled();
  },
);
it("Hono経由のサービス登録・退会 / 未登録会員の退会は会員IDを捏造せずユースケースで拒否する", async () => {
  revokeQualifications();
  mocks.withdraw.mockRejectedValueOnce(
    new ApplicationError({ code: "FORBIDDEN", message: "会員登録が必要です" }),
  );
  const response = await request("/api/trpc/access.withdraw", { service: "customer" });
  expect(response.status).toBe(403);
  expect(mocks.withdraw).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({ userId: "", subjectId: "user-1" }),
  });
});
it.each(["access.registration", "access.registerCustomer"])(
  "Hono経由のサービス登録・退会 / %sでも認証失敗を省略しない",
  async (procedure) => {
    mocks.authenticate.mockRejectedValue(
      new ApplicationError({ code: "UNAUTHORIZED", message: "ログインしてください" }),
    );
    const response =
      procedure === "access.registerCustomer"
        ? await request(`/api/trpc/${procedure}`, { name: "顧客" })
        : await query(procedure, { service: "customer" });
    expect(response.status).toBe(401);
    expect(mocks.registration).not.toHaveBeenCalled();
    expect(mocks.registerCustomer).not.toHaveBeenCalled();
  },
);
it("Hono経由のサービス登録・退会 / 登録済みでも所属のない会員はsessionを取得できる", async () => {
  mocks.organizations.mockResolvedValue([]);
  const response = await query("access.session", { service: "customer" });
  expect(response.status).toBe(200);
  expect(mocks.session).toHaveBeenCalledOnce();
  expect(mocks.qualified).not.toHaveBeenCalled();
});
it.each([
  "access.registration,access.session",
  "access.session,access.registration",
  "access.registration,access.registration",
])(
  "ライフサイクル操作のバッチ事前検査 / %sは未登録でも全操作の開始前に拒否する",
  async (procedures) => {
    revokeQualifications();
    const input = { 0: { service: "customer" }, 1: { service: "business" } };
    const response = await request(
      `/api/trpc/${procedures}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
    );
    expect(response.status).toBe(400);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
    expect(mocks.registration).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  },
);
it.each([
  "access.withdraw,order.create",
  "order.create,access.withdraw",
  "access.withdraw%2Corder.create",
  "access.withdraw,order.create/",
  "access.withdraw,order.create//",
  "access.withdraw%2Corder.create/",
  "access.acceptInvitation,order.create",
  "access.registerCustomer,order.create",
])(
  "ライフサイクル操作のバッチ事前検査 / 登録済みでも%sはどの操作も開始しない",
  async (procedures) => {
    const response = await request(`/api/trpc/${procedures}?batch=1`, {
      0: { service: "customer" },
      1: orderInput,
    });
    expect(response.status).toBe(400);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.registerCustomer).not.toHaveBeenCalled();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  },
);
