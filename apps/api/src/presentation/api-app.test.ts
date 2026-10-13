import {
  mocks,
  services,
  unavailableEndpoints,
  productInput,
  request,
  query,
  expectNoServiceWork,
  revokeQualifications,
} from "#api/presentation/api-app.test-fixture.ts";
import { expect, it } from "vite-plus/test";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { apiApp } from "#api/presentation/api-app.ts";

it.each(services)(
  "共通RPC入口と明示的なサービス選択 / 共通のsessionを%sの会員IDで実行する",
  async (service) => {
    const channel = service === "operator" ? "admin" : service;
    const response = await query("access.session", { service });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      result: { data: { channel, accountId: `${service}:user-1` } },
    });
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith({
      identity: expect.objectContaining({ channel, userId: `${service}:user-1` }),
    });
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(mocks.resolveAccount).toHaveBeenCalledExactlyOnceWith("user-1", service);
    expect(mocks.isRegistered.mock.calls).toEqual([
      [`${service}:user-1`, service],
      [`${service}:user-1`, service],
    ]);
    if (service === "operator") {
      expect(mocks.qualified.mock.calls).toEqual([
        ["operator:user-1", "platform", "operator"],
        ["operator:user-1", "platform", "operator"],
      ]);
    } else {
      expect(mocks.qualified).not.toHaveBeenCalled();
    }

    expect(mocks.organizations).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  },
);
it.each(services)(
  "共通RPC入口と明示的なサービス選択 / service=%sの指定だけでは未登録のsessionを取得できない",
  async (service) => {
    revokeQualifications();
    const response = await query("access.session", { service });
    expect(response.status).toBe(403);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(mocks.session).not.toHaveBeenCalled();
  },
);
it.each(["access.session", "access.registration", "health", "order.list", "product.list"])(
  "共通RPC入口と明示的なサービス選択 / %sはサービス省略を会員解決前に拒否する",
  async (procedure) => {
    const response = await request(`/api/trpc/${procedure}`);
    expect(response.status).toBe(400);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
  },
);
it.each(["admin", "unknown", "", null])(
  "共通RPC入口と明示的なサービス選択 / 不正なサービス%sは会員解決前に拒否する",
  async (service) => {
    const response = await query("access.session", { service });
    expect(response.status).toBe(400);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
    expect(mocks.session).not.toHaveBeenCalled();
  },
);
it.each(unavailableEndpoints)(
  "共通RPC入口と明示的なサービス選択 / 廃止・未知・類似の入口%sを認証前に404にする",
  async (endpoint) => {
    const response = await request(`${endpoint}/access.session`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "APIが見つかりません", code: "NOT_FOUND" });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  },
);
it.each([
  "/api/customer/products/p1/image?service=customer",
  "/api/customer/products/p1/images/i1?service=customer",
])("共通RPC入口と明示的なサービス選択 / 旧顧客画像経路%sも認証前に404にする", async (path) => {
  const response = await request(path);
  expect(response.status).toBe(404);
  expect(mocks.authenticate).not.toHaveBeenCalled();
});
it("共通RPC入口と明示的なサービス選択 / 公開の死活監視だけは本人認証を必要としない", async () => {
  const response = await request("/api/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(mocks.authenticate).not.toHaveBeenCalled();
});
it("Honoの本人認証とRPCエラー境界 / 不正なJSONでも会員・権限の解決や業務処理を開始しない", async () => {
  const response = await apiApp.request("http://localhost/api/trpc/order.create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
  });
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expectNoServiceWork();
});
it("Honoの本人認証とRPCエラー境界 / 未知のRPC手続きでは会員・権限の解決や業務処理を開始しない", async () => {
  const response = await query("order.unknown", { service: "customer" });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: expect.objectContaining({ data: expect.objectContaining({ code: "NOT_FOUND" }) }),
  });
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expectNoServiceWork();
});
it("Honoの本人認証とRPCエラー境界 / 混在バッチの本人認証失敗を一回の認証から各RPCの401へ変換する", async () => {
  mocks.authenticate.mockRejectedValueOnce(
    new ApplicationError({ code: "UNAUTHORIZED", message: "ログインしてください" }),
  );
  const input = { 0: { service: "customer" }, 1: { service: "business" } };
  const response = await request(
    `/api/trpc/order.list,product.list?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
  );
  expect(response.status).toBe(401);
  const denied = {
    error: expect.objectContaining({
      message: "ログインしてください",
      data: expect.objectContaining({ code: "UNAUTHORIZED", httpStatus: 401 }),
    }),
  };
  const body = await response.json();
  expect(body).toEqual([denied, denied]);
  expect(JSON.stringify(body)).not.toContain('"stack"');
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expectNoServiceWork();
});
it("プロシージャごとの会員・企業分離 / 同じ主体のcustomerとbusinessを混在バッチでも独立した会員として解決する", async () => {
  const input = { 0: { service: "customer" }, 1: { service: "business" } };
  const response = await request(
    `/api/trpc/order.list,product.list?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
    undefined,
    "http://localhost",
    { "x-organization-id": "org-1" },
  );
  expect(response.status).toBe(200);
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expect(mocks.resolveAccount).toHaveBeenCalledTimes(2);
  expect(mocks.resolveAccount).toHaveBeenCalledWith("user-1", "customer");
  expect(mocks.resolveAccount).toHaveBeenCalledWith("user-1", "business");
  expect(mocks.grant).toHaveBeenCalledWith("customer:user-1", "org-1");
  expect(mocks.grant).toHaveBeenCalledWith("business:user-1", "org-1");
  expect(mocks.listOrders).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({
      userId: "customer:user-1",
      subjectId: "user-1",
      channel: "customer",
      tenantId: "org-1",
      permissions: CUSTOMER_PERMISSIONS,
    }),
    page: { limit: 25, cursor: undefined },
    filters: {},
  });
  expect(mocks.listProducts).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({
      userId: "business:user-1",
      subjectId: "user-1",
      channel: "business",
      tenantId: "org-1",
      permissions: BUSINESS_PERMISSIONS,
    }),
    page: { limit: 25, cursor: undefined },
    filters: {},
  });
});
it("プロシージャごとの会員・企業分離 / 同一バッチの登録済みサービスから別サービスへ資格を流用しない", async () => {
  mocks.isRegistered.mockImplementation(async (_userId, service) => service === "customer");
  const input = { 0: { service: "customer" }, 1: { service: "business" } };
  const response = await request(
    `/api/trpc/access.session,access.session?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
  );
  expect(response.status).toBe(207);
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expect(await response.json()).toEqual([
    { result: { data: { channel: "customer", accountId: "customer:user-1" } } },
    { error: expect.objectContaining({ data: expect.objectContaining({ code: "FORBIDDEN" }) }) },
  ]);
  expect(mocks.session).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({ channel: "customer" }),
  });
});
it.each([false, true])(
  "プロシージャごとの会員・企業分離 / 同じバッチの権限を別会員へ流用しない（企業が先=%s）",
  async (businessFirst) => {
    mocks.grant.mockImplementation(async (userId) => ({
      active: true,
      protectedRole: false,
      permissions: userId === "business:user-1" ? ["product.read"] : [],
    }));
    const selected = businessFirst ? ["business", "customer"] : ["customer", "business"];
    const input = { 0: { service: selected[0] }, 1: { service: selected[1] } };
    const response = await request(
      `/api/trpc/product.list,product.list?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      undefined,
      "http://localhost",
      { "x-organization-id": "org-1" },
    );
    expect(response.status).toBe(207);
    const allowed = { result: { data: [] } };
    const denied = {
      error: expect.objectContaining({ data: expect.objectContaining({ code: "FORBIDDEN" }) }),
    };
    expect(await response.json()).toEqual(businessFirst ? [allowed, denied] : [denied, allowed]);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(mocks.resolveAccount).toHaveBeenCalledTimes(2);
    expect(mocks.grant.mock.calls.filter((props) => props[0] === "customer:user-1")).toEqual([
      ["customer:user-1", "org-1"],
      ["customer:user-1", "org-1"],
    ]);
    expect(mocks.grant.mock.calls.filter((props) => props[0] === "business:user-1")).toEqual([
      ["business:user-1", "org-1"],
      ["business:user-1", "org-1"],
    ]);
    expect(mocks.listProducts).toHaveBeenCalledExactlyOnceWith({
      identity: expect.objectContaining({
        userId: "business:user-1",
        channel: "business",
        tenantId: "org-1",
        permissions: ["product.read"],
      }),
      page: { limit: 25, cursor: undefined },
      filters: {},
    });
  },
);
it("プロシージャごとの会員・企業分離 / 並行する別リクエストで同じ主体の企業選択と権限を共有しない", async () => {
  mocks.grant.mockImplementation(async (_userId, scope) => ({
    active: true,
    protectedRole: false,
    permissions: scope === "org-1" ? ["product.read"] : [],
  }));
  const [allowed, denied] = await Promise.all(
    ["org-1", "org-2"].map((tenantId) =>
      Promise.resolve(
        query("product.list", { service: "business" }, "http://localhost", {
          "x-organization-id": tenantId,
        }),
      ),
    ),
  );
  expect(allowed?.status).toBe(200);
  expect(denied?.status).toBe(403);
  expect(mocks.authenticate).toHaveBeenCalledTimes(2);
  expect(mocks.resolveAccount.mock.calls).toEqual([
    ["user-1", "business"],
    ["user-1", "business"],
  ]);
  for (const tenantId of ["org-1", "org-2"]) {
    expect(
      mocks.grant.mock.calls.filter((props) => {
        const [, scope] = props;
        return scope === tenantId;
      }),
    ).toEqual([
      ["business:user-1", tenantId],
      ["business:user-1", tenantId],
    ]);
  }

  expect(mocks.listProducts).toHaveBeenCalledExactlyOnceWith({
    identity: expect.objectContaining({
      userId: "business:user-1",
      tenantId: "org-1",
      permissions: ["product.read"],
    }),
    page: { limit: 25, cursor: undefined },
    filters: {},
  });
});
it("プロシージャごとの会員・企業分離 / 同じ企業への次のリクエストでも失効した権限を再検査する", async () => {
  const first = await query("product.list", { service: "business" }, "http://localhost", {
    "x-organization-id": "org-1",
  });
  expect(first.status).toBe(200);
  mocks.grant.mockResolvedValue({ active: true, protectedRole: false, permissions: [] });
  const second = await query("product.list", { service: "business" }, "http://localhost", {
    "x-organization-id": "org-1",
  });
  expect(second.status).toBe(403);
  expect(mocks.authenticate).toHaveBeenCalledTimes(2);
  expect(mocks.resolveAccount).toHaveBeenCalledTimes(2);
  expect(mocks.grant).toHaveBeenCalledTimes(4);
  expect(mocks.listProducts).toHaveBeenCalledOnce();
});
it.each(["customer", "business"] as const)(
  "プロシージャごとの会員・企業分離 / %sの企業ヘッダーを変更しても所属は増えない",
  async (service) => {
    mocks.grant.mockResolvedValue(null);
    const response = await query("order.list", { service }, "http://localhost", {
      "x-organization-id": "foreign-org",
    });
    expect(response.status).toBe(403);
    expect(mocks.grant).toHaveBeenCalledExactlyOnceWith(`${service}:user-1`, "foreign-org");
    expect(mocks.listOrders).not.toHaveBeenCalled();
  },
);
it.each(["order.list", "product.list"])(
  "プロシージャごとの会員・企業分離 / %sはoperatorを商取引サービスとして受け付けない",
  async (procedure) => {
    const response = await query(procedure, { service: "operator" });
    expect(response.status).toBe(403);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
  },
);
it("プロシージャごとの会員・企業分離 / 商品作成は入力による偽装にかかわらずbusinessの会員を解決する", async () => {
  const response = await request(
    "/api/trpc/product.create",
    {
      ...productInput,
      service: "customer",
    },
    "http://localhost",
    { "x-organization-id": "org-1" },
  );
  expect(response.status).toBe(200);
  expect(mocks.resolveAccount).toHaveBeenCalledExactlyOnceWith("user-1", "business");
  expect(mocks.createProduct).toHaveBeenCalledWith({
    actor: expect.objectContaining({ userId: "business:user-1", channel: "business" }),
    input: expect.objectContaining(productInput),
  });
});
it("プロシージャごとの会員・企業分離 / 顧客会員の存在だけでは固定businessの商品作成を許可しない", async () => {
  mocks.isRegistered.mockImplementation(async (_userId, service) => service === "customer");
  const response = await request("/api/trpc/product.create", {
    ...productInput,
    service: "customer",
  });
  expect(response.status).toBe(403);
  expect(mocks.resolveAccount).toHaveBeenCalledExactlyOnceWith("user-1", "business");
  expect(mocks.createProduct).not.toHaveBeenCalled();
});
it("プロシージャごとの会員・企業分離 / 企業メンバー閲覧はcustomerの指定を拒否する", async () => {
  const response = await query("access.members", { service: "customer", scope: "org-1" });
  expect(response.status).toBe(403);
  expect(mocks.authenticate).toHaveBeenCalledOnce();
  expectNoServiceWork();
  expect(mocks.listMembers).not.toHaveBeenCalled();
});
it.each(["platform", "foreign-org"])(
  "プロシージャごとの会員・企業分離 / businessから別スコープ%sを選択できない",
  async (scope) => {
    const response = await query(
      "access.members",
      { service: "business", scope },
      "http://localhost",
      { "x-organization-id": "org-1" },
    );
    expect(response.status).toBe(403);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.listMembers).not.toHaveBeenCalled();
  },
);
