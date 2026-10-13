import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";

import {
  API_ORIGIN,
  ServiceCategory,
  serviceQuery,
  idSchema,
  sessionSchema,
  registration,
  enrollByInvitation,
} from "@/e2e/service-account-fixtures";

test("HTTP: 同じ本人のサービス登録・退会・再登録と注文所有者を独立させる", async (props) => {
  const prepared = await createHttpServiceLifecycleFixture({
    playwright: props.playwright,
    request: props.request,
  });
  const {
    subject,
    email,
    identity,
    tenantHeaders,
    sku,
    lines,
    orderStateSchema,
    withdraw,
    session,
  } = prepared;
  try {
    const initialState = {
      playwright: props.playwright,
      request: props.request,
      subject,
      email,
      identity,
      tenantHeaders,
      sku,
      lines,
      orderStateSchema,
      withdraw,
      session,
    };
    const flow0 = await verifyUnregisteredCustomerBoundary(initialState);
    const flow1 = await rejectCustomerAccessBeforeRegistration(flow0);
    const flow2 = await registerIndependentHttpCustomer(flow1);
    const flow3 = await createHistoricalHttpOrder(flow2);
    const flow4 = await withdrawAndRejectFormerCustomer(flow3);
    const flow5 = await verifyRetainedBusinessOrder(flow4);
    const flow6 = await reregisterWithIndependentOrderOwnership(flow5);
    const flow7 = await stopOperatorWithoutAffectingOtherAccounts(flow6);
    const flow8 = await verifyUnregisteredCustomerBoundary8(flow7);
    await rejectCustomerAccessBeforeRegistration9(flow8);
  } finally {
    await identity.dispose();
  }
});

async function createHttpServiceLifecycleFixture(state: {
  playwright: Pick<typeof import("@playwright/test"), "request">;
  request: APIRequestContext;
}) {
  const { playwright, request } = state;
  const subject = `http-lifecycle-${crypto.randomUUID()}`;
  const email = `${subject}@example.com`;
  const identity = await playwright.request.newContext({
    baseURL: API_ORIGIN,
    extraHTTPHeaders: { "x-demo-user": subject, "x-demo-email": email },
  });
  const tenantHeaders = { "x-organization-id": "demo-store" };
  const sku = `http-withdrawal-history-${crypto.randomUUID()}`;
  expect(
    (
      await request.post(`${API_ORIGIN}/api/trpc/product.create`, {
        headers: { "x-organization-id": "demo-store" },
        data: { sku, name: "退会前の注文", unitPrice: 100 },
      })
    ).status(),
  ).toBe(200);
  const lines = [{ sku, name: "退会前の注文", quantity: 1, unitPrice: 100 }];
  const orderStateSchema = z.object({
    result: z.object({
      data: z.object({ id: z.string(), version: z.number() }),
    }),
  });
  const withdraw = (category: ServiceCategory) =>
    identity.post("/api/trpc/access.withdraw", {
      data: { service: category },
    });
  const session = async (category: ServiceCategory) => {
    const response = await identity.get("/api/trpc/access.session", serviceQuery(category));
    expect(response.status()).toBe(200);
    return sessionSchema.parse(await response.json()).result.data;
  };
  return {
    ...state,
    subject,
    email,
    identity,
    tenantHeaders,
    sku,
    lines,
    orderStateSchema,
    withdraw,
    session,
  };
}

async function verifyUnregisteredCustomerBoundary(
  state: Awaited<ReturnType<typeof createHttpServiceLifecycleFixture>>,
) {
  const { request, email, identity } = state;
  await enrollByInvitation(request, identity, email, "business", "demo-store", "demo-store:staff");
  const business = await registration(identity, "business");
  expect(business.registered).toBe(true);
  expect(await registration(identity, "customer")).toEqual({
    registered: false,
    category: "customer",
    accountId: null,
  });
  expect((await registration(identity, "operator")).registered).toBe(false);
  return { ...state, business };
}

async function rejectCustomerAccessBeforeRegistration(
  state: Awaited<ReturnType<typeof verifyUnregisteredCustomerBoundary>>,
) {
  const { request, email, identity, tenantHeaders, business } = state;
  for (const headers of [{}, tenantHeaders]) {
    const denied = await identity.get("/api/trpc/access.session", {
      ...serviceQuery("customer"),
      headers,
    });
    expect(denied.status()).toBe(403);
    expect(await denied.json()).toMatchObject({
      error: { data: { code: "FORBIDDEN" } },
    });
  }

  expect((await registration(identity, "customer")).registered).toBe(false);
  expect(await registration(identity, "business")).toEqual(business);
  await enrollByInvitation(request, identity, email, "operator", "platform", "platform:assistant");
  const operator = await registration(identity, "operator");
  return { ...state, operator };
}

async function registerIndependentHttpCustomer(
  state: Awaited<ReturnType<typeof rejectCustomerAccessBeforeRegistration>>,
) {
  const { identity, session, business, operator } = state;
  const enrolled = await identity.post("/api/trpc/access.registerCustomer", {
    data: { name: "HTTP顧客" },
  });
  expect(enrolled.status()).toBe(200);
  const customer = await registration(identity, "customer");
  expect(customer.registered).toBe(true);
  expect(customer.accountId).not.toBe(business.accountId);
  expect(customer.accountId).not.toBe(operator.accountId);
  expect(await registration(identity, "business")).toEqual(business);
  expect(await registration(identity, "operator")).toEqual(operator);
  expect(await session("customer")).toMatchObject({
    userId: customer.accountId,
    organizations: [],
  });
  const duplicate = await identity.post("/api/trpc/access.registerCustomer", {
    data: { name: "二重登録" },
  });
  expect(duplicate.status()).toBe(409);
  expect(await registration(identity, "customer")).toEqual(customer);
  return { ...state, enrolled, customer, duplicate };
}

async function createHistoricalHttpOrder(
  state: Awaited<ReturnType<typeof registerIndependentHttpCustomer>>,
) {
  const { request, email, identity, tenantHeaders, lines, customer } = state;
  const rejectedInvitation = await request.post(`${API_ORIGIN}/api/trpc/access.invite`, {
    data: {
      service: "operator",
      scope: "demo-store",
      email,
      actorKind: "customer",
      roleId: "demo-store:staff",
    },
  });
  expect(rejectedInvitation.status()).toBe(403);
  expect((await registration(identity, "customer")).accountId).toBe(customer.accountId);
  const customerPlan = await identity.post("/api/trpc/access.changeCustomerPlan", {
    data: { planCode: "customer:demo" },
  });
  expect(customerPlan.status()).toBe(200);
  const created = await identity.post("/api/trpc/order.create", {
    headers: tenantHeaders,
    data: { service: "customer", draft: true, lines },
  });
  expect(created.status()).toBe(200);
  return { ...state, customerPlan, created };
}

async function withdrawAndRejectFormerCustomer(
  state: Awaited<ReturnType<typeof createHistoricalHttpOrder>>,
) {
  const {
    identity,
    tenantHeaders,
    orderStateSchema,
    withdraw,
    session,
    business,
    operator,
    created,
  } = state;
  const oldOrder = orderStateSchema.parse(await created.json()).result.data;
  const customerOrders = await identity.get("/api/trpc/order.list", {
    ...serviceQuery("customer"),
    headers: tenantHeaders,
  });
  expect(customerOrders.status()).toBe(200);
  expect(await customerOrders.text()).toContain(oldOrder.id);
  const withdrawn = await withdraw("customer");
  expect(withdrawn.status()).toBe(200);
  expect(await withdrawn.json()).toMatchObject({
    result: { data: { category: "customer" } },
  });
  expect((await registration(identity, "customer")).registered).toBe(false);
  expect((await identity.get("/api/trpc/access.session", serviceQuery("customer"))).status()).toBe(
    403,
  );
  expect(await registration(identity, "business")).toEqual(business);
  expect(await registration(identity, "operator")).toEqual(operator);
  expect((await session("business")).userId).toBe(business.accountId);
  expect((await session("operator")).userId).toBe(operator.accountId);
  return { ...state, oldOrder, customerOrders, withdrawn };
}

async function verifyRetainedBusinessOrder(
  state: Awaited<ReturnType<typeof withdrawAndRejectFormerCustomer>>,
) {
  const { identity, tenantHeaders, session, customer, oldOrder } = state;
  const retainedOrders = await identity.get("/api/trpc/order.list", {
    ...serviceQuery("business"),
    headers: tenantHeaders,
  });
  expect(retainedOrders.status()).toBe(200);
  expect(await retainedOrders.text()).toContain(oldOrder.id);
  const reenrolled = await identity.post("/api/trpc/access.registerCustomer", {
    data: { name: "HTTP再登録顧客" },
  });
  expect(reenrolled.status()).toBe(200);
  const newCustomer = await registration(identity, "customer");
  expect(newCustomer.registered).toBe(true);
  expect(newCustomer.accountId).not.toBe(customer.accountId);
  expect(await session("customer")).toMatchObject({
    userId: newCustomer.accountId,
    organizations: [],
  });
  return { ...state, retainedOrders, reenrolled, newCustomer };
}

async function reregisterWithIndependentOrderOwnership(
  state: Awaited<ReturnType<typeof verifyRetainedBusinessOrder>>,
) {
  const { request, email, identity, tenantHeaders } = state;
  expect(
    (
      await identity.get("/api/trpc/order.list", {
        ...serviceQuery("customer"),
        headers: tenantHeaders,
      })
    ).status(),
  ).toBe(403);
  const rejectedInvitation = await request.post(`${API_ORIGIN}/api/trpc/access.invite`, {
    data: {
      service: "operator",
      scope: "demo-store",
      email,
      actorKind: "customer",
      roleId: "demo-store:staff",
    },
  });
  expect(rejectedInvitation.status()).toBe(403);
  const newCustomerOrders = await identity.get("/api/trpc/order.list", {
    ...serviceQuery("customer"),
    headers: tenantHeaders,
  });
  expect(newCustomerOrders.status()).toBe(403);
  return { ...state, newCustomerOrders };
}

async function stopOperatorWithoutAffectingOtherAccounts(
  state: Awaited<ReturnType<typeof reregisterWithIndependentOrderOwnership>>,
) {
  const { identity, tenantHeaders, lines, withdraw, oldOrder } = state;
  const renewedPlan = await identity.post("/api/trpc/access.changeCustomerPlan", {
    data: { planCode: "customer:demo" },
  });
  expect(renewedPlan.status()).toBe(200);
  const renewedOrders = await identity.get("/api/trpc/order.list", {
    ...serviceQuery("customer"),
    headers: tenantHeaders,
  });
  expect(renewedOrders.status()).toBe(200);
  expect(await renewedOrders.text()).not.toContain(oldOrder.id);
  const oldOrderEdit = await identity.post("/api/trpc/order.update", {
    headers: tenantHeaders,
    data: { service: "customer", ...oldOrder, lines },
  });
  expect(oldOrderEdit.status()).toBe(403);
  expect((await withdraw("business")).status()).toBe(200);
  expect((await registration(identity, "business")).registered).toBe(false);
  return { ...state, renewedPlan, renewedOrders, oldOrderEdit };
}

async function verifyUnregisteredCustomerBoundary8(
  state: Awaited<ReturnType<typeof stopOperatorWithoutAffectingOtherAccounts>>,
) {
  const { request, subject, identity, withdraw, session, operator, newCustomer } = state;
  expect((await identity.get("/api/trpc/access.session", serviceQuery("business"))).status()).toBe(
    403,
  );
  expect((await session("operator")).userId).toBe(operator.accountId);
  expect((await session("customer")).userId).toBe(newCustomer.accountId);
  expect((await withdraw("operator")).status()).toBe(200);
  expect((await registration(identity, "operator")).registered).toBe(false);
  expect((await identity.get("/api/trpc/access.session", serviceQuery("operator"))).status()).toBe(
    403,
  );
  expect((await session("customer")).userId).toBe(newCustomer.accountId);
  const organization = await request.post(`${API_ORIGIN}/api/trpc/access.createOrganization`, {
    data: { name: `最終オーナー-${subject}` },
  });
  expect(organization.status()).toBe(200);
  const organizationId = idSchema.parse(await organization.json()).result.data.id;
  return { ...state, organization, organizationId };
}

async function rejectCustomerAccessBeforeRegistration9(
  state: Awaited<ReturnType<typeof verifyUnregisteredCustomerBoundary8>>,
) {
  const { request, email, identity, withdraw, session, business, newCustomer, organizationId } =
    state;
  await enrollByInvitation(
    request,
    identity,
    email,
    "business",
    organizationId,
    `${organizationId}:owner`,
  );
  const owner = await registration(identity, "business");
  expect(owner.accountId).not.toBe(business.accountId);
  const refused = await withdraw("business");
  expect(refused.status()).toBe(409);
  expect(await refused.json()).toMatchObject({
    error: { data: { code: "CONFLICT" } },
  });
  expect(await registration(identity, "business")).toEqual(owner);
  expect(await session("business")).toMatchObject({
    userId: owner.accountId,
    organizations: [{ id: organizationId }],
  });
  expect(await registration(identity, "customer")).toEqual(newCustomer);
  return { ...state, owner, refused };
}
