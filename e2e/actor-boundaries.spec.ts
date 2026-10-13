import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

const API_ORIGIN = E2E_SERVER_ORIGINS.api;
const SERVICES = ["customer", "business", "operator"] as const;

type ServiceCategory = (typeof SERVICES)[number];

const serviceQuery = (service: ServiceCategory) => ({
  params: { input: JSON.stringify({ service }) },
});
const INVALID_INVITATION_TOKEN = "c".repeat(64);

for (const [userId, allowedService, forbiddenService] of [
  ["demo-member", "business", "customer"],
  ["demo-member", "business", "operator"],
  ["demo-customer", "customer", "business"],
  ["demo-customer", "customer", "operator"],
] as const) {
  test(`${userId}: 共通APIで${allowedService}から${forbiddenService}へserviceを変えても権限は増えない`, async (props) => {
    const client = await props.playwright.request.newContext({
      baseURL: API_ORIGIN,
      extraHTTPHeaders: { "x-demo-user": userId },
    });
    try {
      const allowed = await client.get("/api/trpc/access.session", {
        ...serviceQuery(allowedService),
        headers: { "x-organization-id": "demo-store" },
      });
      expect(allowed.status()).toBe(200);
      for (const selectedTenant of [false, true]) {
        const procedures =
          forbiddenService === "operator"
            ? ["access.session", "health"]
            : ["access.session", "health", "order.list", "product.list"];
        for (const procedure of procedures) {
          const response = await client.get(`/api/trpc/${procedure}`, {
            ...serviceQuery(forbiddenService),
            headers: selectedTenant ? { "x-organization-id": "demo-store" } : {},
          });
          expect(response.status()).toBe(403);
          expect(await response.json()).toMatchObject({
            error: { data: { code: "FORBIDDEN" } },
          });
        }

        const operatorOnly = await client.get("/api/trpc/access.users", {
          headers: selectedTenant ? { "x-organization-id": "demo-store" } : {},
        });
        expect(operatorOnly.status()).toBe(403);
      }
    } finally {
      await client.dispose();
    }
  });
}

test("企業IDと管理者ヘッダーの偽装は所属する企業を増やさない", async (props) => {
  for (const [userId, service] of [
    ["demo-member", "business"],
    ["demo-customer", "customer"],
  ] as const) {
    for (const scope of ["demo-second", "platform"]) {
      const response = await props.request.get(`${API_ORIGIN}/api/trpc/access.session`, {
        ...serviceQuery(service),
        headers: {
          "x-demo-user": userId,
          "x-demo-role": "admin",
          "x-demo-tenant": scope,
          "x-organization-id": scope,
        },
      });
      const ordinaryShopper = service === "customer" && scope !== "platform";
      expect(response.status()).toBe(ordinaryShopper ? 200 : 403);
      if (ordinaryShopper) {
        const session = z
          .object({
            result: z.object({
              data: z.object({
                organizations: z.array(z.unknown()),
                platformPermissions: z.array(z.string()),
              }),
            }),
          })
          .parse(await response.json()).result.data;
        expect(session.organizations).toEqual([]);
        expect(session.platformPermissions).toEqual([]);
      }
    }
  }
});

test("未登録の認証済みユーザーは企業未選択でもセッションやRPCヘルスを取得できない", async (props) => {
  const headers = { "x-demo-user": `unregistered-${crypto.randomUUID()}` };
  for (const service of SERVICES) {
    for (const procedure of ["access.session", "health"]) {
      const response = await props.request.get(`${API_ORIGIN}/api/trpc/${procedure}`, {
        ...serviceQuery(service),
        headers,
      });
      expect(response.status()).toBe(403);
    }
  }
});

for (const service of SERVICES) {
  test(`${service}: 招待承諾の種別境界を検証し、他のRPCと混在させると全体を拒否する`, async (props) => {
    const headers = {
      "x-demo-user": `invitation-bootstrap-${crypto.randomUUID()}`,
      "x-demo-email": "bootstrap-boundary@example.com",
    };
    const input = { service, token: INVALID_INVITATION_TOKEN, name: "未所属の利用者" };
    const acceptedEntry = await props.request.post(
      `${API_ORIGIN}/api/trpc/access.acceptInvitation`,
      {
        headers,
        data: input,
      },
    );
    expect(acceptedEntry.status()).toBe(service === "customer" ? 403 : 400);
    expect(await acceptedEntry.json()).toMatchObject({
      error: {
        message:
          service === "customer" ? "この操作を行う権限がありません" : "招待が無効か期限切れです",
        data: { code: service === "customer" ? "FORBIDDEN" : "BAD_REQUEST" },
      },
    });
    const mixed = await props.request.post(
      `${API_ORIGIN}/api/trpc/access.acceptInvitation,order.create?batch=1`,
      {
        headers,
        data: {
          0: input,
          1: {
            service: "business",
            draft: true,
            lines: [{ sku: "forbidden", name: "拒否される注文", quantity: 1, unitPrice: 100 }],
          },
        },
      },
    );
    expect(mixed.status()).toBe(400);
    expect(await mixed.json()).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
      }),
      expect.objectContaining({
        error: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
      }),
    ]);
  });

  test(`${service}: 登録状態の読み取りもライフサイクル混在バッチでは全体を拒否する`, async (props) => {
    const response = await props.request.get(
      `${API_ORIGIN}/api/trpc/access.registration,access.session`,
      {
        params: {
          batch: "1",
          input: JSON.stringify({ 0: { service }, 1: { service } }),
        },
      },
    );
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
      }),
      expect.objectContaining({
        error: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
      }),
    ]);
  });
}

// 画面ホストを変えても権限は変わらないため、直接APIと3画面の入口を同じ条件で通す。
for (const origin of Object.values(E2E_SERVER_ORIGINS)) {
  test(`${origin}: 廃止・不明なAPI入口は会員登録があっても404`, async (props) => {
    for (const path of [
      "/api/customer/trpc/access.session",
      "/api/customer/trpc/access.acceptInvitation",
      "/api/business/trpc/access.session",
      "/api/admin/trpc/access.session",
      "/api/unknown/trpc/access.session",
      "/api/business/trpc-other/access.session",
      "/api/trpc-other/access.session",
      "/api/customer/products/missing/image",
      "/api/business/products/missing/image",
      "/api/admin/products/missing/image",
    ]) {
      const response = await props.request.get(`${origin}${path}`);
      expect(response.status()).toBe(404);
    }
  });

  test(`${origin}: すべての画面と直接APIで同じ会員・権限判定を使う`, async (props) => {
    const headers = { "x-demo-user": "demo-user", "x-organization-id": "demo-store" };
    for (const service of SERVICES) {
      const response = await props.request.get(`${origin}/api/trpc/access.session`, {
        ...serviceQuery(service),
        headers,
      });
      expect(response.status()).toBe(200);
    }

    const members = await props.request.get(`${origin}/api/trpc/access.members`, {
      headers,
      params: { input: JSON.stringify({ service: "business", scope: "demo-store" }) },
    });
    expect(members.status()).toBe(200);
    const operator = await props.request.get(`${origin}/api/trpc/access.users`, { headers });
    expect(operator.status()).toBe(200);
    const product = await props.request.post(`${origin}/api/trpc/product.create`, {
      headers,
      data: { sku: `common-${crypto.randomUUID()}`, name: "共通APIの商品", unitPrice: 100 },
    });
    expect(product.status()).toBe(200);
    const deniedProduct = await props.request.post(`${origin}/api/trpc/product.create`, {
      headers: { ...headers, "x-demo-user": "demo-customer" },
      data: { sku: `denied-${crypto.randomUUID()}`, name: "拒否される商品", unitPrice: 100 },
    });
    expect(deniedProduct.status()).toBe(403);
    const denied = await props.request.get(`${origin}/api/trpc/access.users`, {
      headers: { ...headers, "x-demo-user": "demo-member" },
    });
    expect(denied.status()).toBe(403);
  });
}

test("共通RPCは不正なserviceを400、許可されない会員種別を403で拒否する", async (props) => {
  for (const service of [undefined, "admin", "platform", "unknown"]) {
    const response = await props.request.get(`${API_ORIGIN}/api/trpc/access.session`, {
      params: { input: JSON.stringify(service === undefined ? {} : { service }) },
    });
    expect(response.status()).toBe(400);
  }

  for (const procedure of ["order.list", "product.list"]) {
    const response = await props.request.get(
      `${API_ORIGIN}/api/trpc/${procedure}`,
      serviceQuery("operator"),
    );
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ error: { data: { code: "FORBIDDEN" } } });
  }
});

test("同じClerk本人の企業権限でも一般ユーザーの注文所有は独立し、一般ユーザーは出荷できない", async (props) => {
  const initialState = { request: props.request };
  const flow0 = await createAnotherCustomerOrder(initialState);
  const flow1 = await verifyCustomerOrderIsolation(flow0);
  const flow2 = await verifyDualAccountOwnership(flow1);
  await rejectCustomerShipment(flow2);
});

async function createAnotherCustomerOrder(state: { request: APIRequestContext }) {
  const { request } = state;
  const businessHeaders = { "x-demo-user": "demo-user", "x-organization-id": "demo-store" };
  const customerHeaders = { "x-demo-user": "demo-customer", "x-organization-id": "demo-store" };
  const sku = `rpc-boundary-${crypto.randomUUID()}`;
  expect(
    (
      await request.post(`${API_ORIGIN}/api/trpc/product.create`, {
        headers: businessHeaders,
        data: { sku, name: "本人注文の検証", unitPrice: 100 },
      })
    ).status(),
  ).toBe(200);
  const lines = [{ sku, name: "本人注文の検証", quantity: 1, unitPrice: 100 }];
  const createdSchema = z.object({
    result: z.object({ data: z.object({ id: z.string(), version: z.number() }) }),
  });
  const rejected = await request.post(`${API_ORIGIN}/api/trpc/order.create`, {
    headers: businessHeaders,
    data: { service: "business", draft: true, lines },
  });
  expect(rejected.status()).toBe(403);
  const otherHeaders = await registerOtherShopper(request);
  const other = await request.post(`${API_ORIGIN}/api/trpc/order.create`, {
    headers: otherHeaders,
    data: { service: "customer", draft: true, lines },
  });
  expect(other.status()).toBe(200);
  const otherOrder = createdSchema.parse(await other.json()).result.data;
  return {
    ...state,
    businessHeaders,
    customerHeaders,
    sku,
    lines,
    createdSchema,
    other,
    otherOrder,
  };
}

async function verifyCustomerOrderIsolation(
  state: Awaited<ReturnType<typeof createAnotherCustomerOrder>>,
) {
  const { request, businessHeaders, customerHeaders, lines, createdSchema, otherOrder } = state;
  const owned = await request.post(`${API_ORIGIN}/api/trpc/order.create`, {
    headers: customerHeaders,
    data: { service: "customer", draft: true, lines },
  });
  expect(owned.status()).toBe(200);
  const ownOrder = createdSchema.parse(await owned.json()).result.data;
  const listed = await request.get(`${API_ORIGIN}/api/trpc/order.list`, {
    ...serviceQuery("customer"),
    headers: customerHeaders,
  });
  expect(listed.status()).toBe(200);
  const listedBody = await listed.text();
  expect(listedBody).toContain(ownOrder.id);
  expect(listedBody).not.toContain(otherOrder.id);
  const dualQualifiedList = await request.get(`${API_ORIGIN}/api/trpc/order.list`, {
    ...serviceQuery("customer"),
    headers: businessHeaders,
  });
  expect(dualQualifiedList.status()).toBe(200);
  const dualQualifiedListBody = await dualQualifiedList.text();
  expect(dualQualifiedListBody).not.toContain(otherOrder.id);
  expect(dualQualifiedListBody).not.toContain(ownOrder.id);
  return {
    ...state,
    owned,
    ownOrder,
    listed,
    listedBody,
    dualQualifiedList,
    dualQualifiedListBody,
  };
}

async function verifyDualAccountOwnership(
  state: Awaited<ReturnType<typeof verifyCustomerOrderIsolation>>,
) {
  const { request, businessHeaders, customerHeaders, lines, createdSchema, otherOrder, ownOrder } =
    state;
  const ownServiceOrder = await request.post(`${API_ORIGIN}/api/trpc/order.create`, {
    headers: businessHeaders,
    data: { service: "customer", draft: true, lines },
  });
  expect(ownServiceOrder.status()).toBe(200);
  const ownService = createdSchema.parse(await ownServiceOrder.json()).result.data;
  const independentList = await request.get(`${API_ORIGIN}/api/trpc/order.list`, {
    ...serviceQuery("customer"),
    headers: businessHeaders,
  });
  expect(await independentList.text()).toContain(ownService.id);
  const dualQualifiedEdit = await request.post(`${API_ORIGIN}/api/trpc/order.update`, {
    headers: businessHeaders,
    data: { service: "customer", ...ownOrder, lines },
  });
  expect(dualQualifiedEdit.status()).toBe(403);
  const forbiddenEdit = await request.post(`${API_ORIGIN}/api/trpc/order.update`, {
    headers: customerHeaders,
    data: { service: "customer", ...otherOrder, lines },
  });
  expect(forbiddenEdit.status()).toBe(403);
  return {
    ...state,
    ownServiceOrder,
    ownService,
    independentList,
    dualQualifiedEdit,
    forbiddenEdit,
  };
}

async function rejectCustomerShipment(
  state: Awaited<ReturnType<typeof verifyDualAccountOwnership>>,
) {
  const { request, businessHeaders, customerHeaders, lines, ownOrder, ownService } = state;
  const forbiddenShipment = await request.post(`${API_ORIGIN}/api/trpc/order.transition`, {
    // 同じ本人が企業会員でも、通常会員としては自分の注文も出荷できない。
    headers: businessHeaders,
    data: { service: "customer", ...ownService, status: "shipped" },
  });
  expect(forbiddenShipment.status()).toBe(403);
  const updated = await request.post(`${API_ORIGIN}/api/trpc/order.update`, {
    headers: customerHeaders,
    data: { service: "customer", ...ownOrder, lines: [{ ...lines[0], quantity: 2 }] },
  });
  expect(updated.status()).toBe(200);
  return { ...state, forbiddenShipment, updated };
}

async function registerOtherShopper(request: APIRequestContext) {
  const otherHeaders = {
    "x-demo-user": `other-shopper-${crypto.randomUUID()}`,
    "x-organization-id": "demo-store",
  };
  const registration = await request.post(`${API_ORIGIN}/api/trpc/access.registerCustomer`, {
    headers: otherHeaders,
    data: { name: "別の一般ユーザー" },
  });
  expect(registration.status()).toBe(200);
  const account = z
    .object({ result: z.object({ data: z.object({ accountId: z.string() }) }) })
    .parse(await registration.json()).result.data;
  expect(account.accountId).toMatch(/^customer:/);
  const assigned = await request.post(`${API_ORIGIN}/api/trpc/access.changeCustomerPlan`, {
    headers: otherHeaders,
    data: { planCode: "customer:demo" },
  });
  expect(assigned.status()).toBe(200);
  return otherHeaders;
}
