import { test, expect } from "@playwright/test";
import type { Browser, APIRequestContext, TestInfo } from "@playwright/test";

import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";
import {
  API_ORIGIN,
  SCREENSHOT_VIEWPORT,
  captureLifecycle,
  serviceQuery,
  idSchema,
  sessionSchema,
  registration,
  enrollByInvitation,
} from "@/e2e/service-account-fixtures";

test("企業・運営と同じ本人が顧客登録し、顧客だけ退会・再登録しても他サービスを維持する", async (props, testInfo) => {
  const prepared = await createServiceLifecycleFixture({
    browser: props.browser,
    request: props.request,
    testInfo,
  });
  const { subject, email, context } = prepared;
  try {
    const initialState = {
      browser: props.browser,
      request: props.request,
      testInfo,
      subject,
      email,
      context,
    };
    const flow0 = await enrollBusinessAndOperatorAccounts(initialState);
    const flow1 = await registerCustomerFromBrowser(flow0);
    const flow2 = await verifyIndependentCustomerIdentity(flow1);
    const flow3 = await prepareHistoricalCustomerProduct(flow2);
    const flow4 = await createOrderAndOpenWithdrawal(flow3);
    const flow5 = await withdrawCustomerAndCheckOtherServices(flow4);
    const flow6 = await verifyHistoryAndRestoreNavigation(flow5);
    await reregisterAndWithdrawOtherServices(flow6);
  } finally {
    await context.close();
  }
});

test("最後の企業オーナーの退会は拒否され、登録と所属が残る", async (props) => {
  const subject = `last-owner-${crypto.randomUUID()}`;
  const email = `${subject}@example.com`;
  const organization = await props.request.post(
    `${API_ORIGIN}/api/trpc/access.createOrganization`,
    {
      data: { name: subject },
    },
  );
  expect(organization.status()).toBe(200);
  const organizationId = idSchema.parse(await organization.json()).result.data.id;
  const context = await props.browser.newContext({
    extraHTTPHeaders: { "x-demo-user": subject, "x-demo-email": email },
  });
  try {
    await enrollByInvitation(
      props.request,
      context.request,
      email,
      "business",
      organizationId,
      `${organizationId}:owner`,
    );
    const page = await context.newPage();
    await page.goto(`${E2E_SERVER_ORIGINS.business}/account`);
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole("button", { name: "事業者サービスを退会する" }).click();
    await expect(page.getByRole("alert")).toContainText("最後のオーナー");
    expect((await registration(context.request, "business")).registered).toBe(true);
    await page.reload();
    await expect(page.getByRole("button", { name: "事業者サービスを退会する" })).toBeVisible();
    const session = await context.request.get(
      `${API_ORIGIN}/api/trpc/access.session`,
      serviceQuery("business"),
    );
    expect(sessionSchema.parse(await session.json()).result.data.organizations).toEqual([
      expect.objectContaining({ id: organizationId }),
    ]);
  } finally {
    await context.close();
  }
});

test("企業・運営の企業メンバー画面は一般ユーザーを表示も招待もできない", async (props) => {
  for (const origin of [E2E_SERVER_ORIGINS.business, E2E_SERVER_ORIGINS.admin]) {
    await props.page.goto(`${origin}/organizations/demo-store/members`);
    await expect(
      props.page.getByRole("heading", { name: "メンバー・権限管理", exact: true }),
    ).toBeVisible();
    await expect(props.page.getByText("デモ一般ユーザー", { exact: true })).toHaveCount(0);
    await expect(props.page.getByText("customer@example.com", { exact: true })).toHaveCount(0);
    const services = props.page.getByLabel("登録先サービス", { exact: true });
    await expect(services.getByRole("option", { name: "事業者", exact: true })).toHaveCount(1);
    await expect(services.locator('option[value="customer"]')).toHaveCount(0);
  }
});

async function createServiceLifecycleFixture(state: {
  browser: Browser;
  request: APIRequestContext;
  testInfo: TestInfo;
}) {
  const { browser } = state;
  const subject = `lifecycle-${crypto.randomUUID()}`;
  const email = `${subject}@example.com`;
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-demo-user": subject, "x-demo-email": email },
    viewport: SCREENSHOT_VIEWPORT,
    colorScheme: "light",
  });
  return { ...state, subject, email, context };
}

async function enrollBusinessAndOperatorAccounts(
  state: Awaited<ReturnType<typeof createServiceLifecycleFixture>>,
) {
  const { request, email, context } = state;
  await enrollByInvitation(
    request,
    context.request,
    email,
    "business",
    "demo-store",
    "demo-store:staff",
  );
  await enrollByInvitation(
    request,
    context.request,
    email,
    "operator",
    "platform",
    "platform:assistant",
  );
  const business = await registration(context.request, "business");
  const operator = await registration(context.request, "operator");
  const page = await context.newPage();
  const registerRequests: string[] = [];
  return { ...state, business, operator, page, registerRequests };
}

async function registerCustomerFromBrowser(
  state: Awaited<ReturnType<typeof enrollBusinessAndOperatorAccounts>>,
) {
  const { testInfo, context, page, registerRequests } = state;
  page.on("request", (outgoing) => {
    if (outgoing.url().includes("access.registerCustomer")) {
      registerRequests.push(outgoing.url());
    }
  });
  await page.goto(`${E2E_SERVER_ORIGINS.web}/register`);
  await expect(page).toHaveURL(`${E2E_SERVER_ORIGINS.web}/register`);
  await expect(page.getByRole("heading", { name: "会員登録" })).toBeVisible();
  expect(registerRequests).toHaveLength(0);
  expect(await registration(context.request, "customer")).toMatchObject({
    registered: false,
    accountId: null,
  });
  await captureLifecycle(page, testInfo, "01-customer-unregistered");
  await expect(page).toHaveURL(`${E2E_SERVER_ORIGINS.web}/register`);
  await expect(page.getByLabel("表示名", { exact: true })).toBeVisible();
  await captureLifecycle(page, testInfo, "02-customer-registration");
  await page.getByRole("button", { name: "会員登録する" }).click();
  await expect(page.getByRole("alert")).toContainText("表示名を正しく入力してください");
  expect(registerRequests).toHaveLength(0);
  await page.getByLabel("表示名", { exact: true }).fill("顧客としての表示名");
  await page.getByRole("button", { name: "会員登録する" }).click();
  await expect(page.getByText("会員登録済みです。", { exact: true })).toBeVisible();
  expect(registerRequests).toHaveLength(1);
  return { ...state };
}

async function verifyIndependentCustomerIdentity(
  state: Awaited<ReturnType<typeof registerCustomerFromBrowser>>,
) {
  const { request, testInfo, email, context, business, operator, page } = state;
  await captureLifecycle(page, testInfo, "03-customer-registered");
  const customer = await registration(context.request, "customer");
  expect(customer.accountId).not.toBe(business.accountId);
  expect(customer.accountId).not.toBe(operator.accountId);
  const customerSession = await context.request.get(
    `${API_ORIGIN}/api/trpc/access.session`,
    serviceQuery("customer"),
  );
  expect(sessionSchema.parse(await customerSession.json()).result.data.organizations).toEqual([]);
  await page.getByRole("link", { name: "商品一覧へ" }).click();
  await expect(page.getByRole("heading", { name: "すべての商品" })).toBeVisible();
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
  expect((await registration(context.request, "customer")).accountId).toBe(customer.accountId);
  return { ...state, customer, customerSession };
}

async function prepareHistoricalCustomerProduct(
  state: Awaited<ReturnType<typeof verifyIndependentCustomerIdentity>>,
) {
  const { request, context } = state;
  const customerPlan = await context.request.post(
    `${API_ORIGIN}/api/trpc/access.changeCustomerPlan`,
    {
      data: { planCode: "customer:demo" },
    },
  );
  expect(customerPlan.status()).toBe(200);
  const sku = `withdrawal-history-${crypto.randomUUID()}`;
  expect(
    (
      await request.post(`${API_ORIGIN}/api/trpc/product.create`, {
        headers: { "x-organization-id": "demo-store" },
        data: { sku, name: "退会前の注文", unitPrice: 100 },
      })
    ).status(),
  ).toBe(200);
  return { ...state, customerPlan, sku };
}

async function createOrderAndOpenWithdrawal(
  state: Awaited<ReturnType<typeof prepareHistoricalCustomerProduct>>,
) {
  const { testInfo, context, page, sku } = state;
  const historical = await context.request.post(`${API_ORIGIN}/api/trpc/order.create`, {
    headers: { "x-organization-id": "demo-store" },
    data: {
      service: "customer",
      draft: true,
      lines: [{ sku, name: "退会前の注文", quantity: 1, unitPrice: 100 }],
    },
  });
  expect(historical.status()).toBe(200);
  const orderId = idSchema.parse(await historical.json()).result.data.id;
  await page.getByRole("link", { name: "アカウント", exact: true }).click();
  await expect(page.getByRole("button", { name: "通販会員を退会する" })).toBeVisible();
  await captureLifecycle(page, testInfo, "04-customer-withdrawal");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("ログインアカウントと他のサービスの登録は残ります");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "通販会員を退会する" }).click();
  expect((await registration(context.request, "customer")).registered).toBe(true);
  return { ...state, historical, orderId };
}

async function withdrawCustomerAndCheckOtherServices(
  state: Awaited<ReturnType<typeof createOrderAndOpenWithdrawal>>,
) {
  const { testInfo, context, business, operator, page } = state;
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("過去の注文履歴は保持されます");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "通販会員を退会する" }).click();
  await expect(
    page.getByText("通販会員を退会しました。ログインアカウントと他のサービスの登録は残ります。"),
  ).toBeVisible();
  await captureLifecycle(page, testInfo, "05-customer-withdrawn");
  expect(await registration(context.request, "business")).toEqual(business);
  expect(await registration(context.request, "operator")).toEqual(operator);
  const businessSession = await context.request.get(
    `${API_ORIGIN}/api/trpc/access.session`,
    serviceQuery("business"),
  );
  expect(businessSession.status()).toBe(200);
  const operatorSession = await context.request.get(
    `${API_ORIGIN}/api/trpc/access.session`,
    serviceQuery("operator"),
  );
  return { ...state, businessSession, operatorSession };
}

async function verifyHistoryAndRestoreNavigation(
  state: Awaited<ReturnType<typeof withdrawCustomerAndCheckOtherServices>>,
) {
  const { testInfo, context, page, orderId, operatorSession } = state;
  expect(operatorSession.status()).toBe(200);
  const retained = await context.request.get(`${API_ORIGIN}/api/trpc/order.list`, {
    ...serviceQuery("business"),
    headers: { "x-organization-id": "demo-store" },
  });
  expect(await retained.text()).toContain(orderId);
  const businessPage = await context.newPage();
  await businessPage.goto(`${E2E_SERVER_ORIGINS.business}/account`);
  await expect(
    businessPage.getByRole("button", { name: "事業者サービスを退会する" }),
  ).toBeVisible();
  await captureLifecycle(businessPage, testInfo, "06-business-still-registered");
  await businessPage.close();
  await page.goBack();
  await expect(page).toHaveURL(`${E2E_SERVER_ORIGINS.web}/`);
  await expect(page.getByRole("heading", { name: "すべての商品", exact: true })).toBeVisible();
  expect((await registration(context.request, "customer")).registered).toBe(false);
  await page.goForward();
  await expect(page).toHaveURL(`${E2E_SERVER_ORIGINS.web}/account`);
  await expect(page.getByRole("heading", { name: "会員登録が必要です" })).toBeVisible();
  await page.getByRole("link", { name: "会員登録へ進む" }).click();
  await page.getByLabel("表示名", { exact: true }).fill("再登録した顧客");
  return { ...state, retained, businessPage };
}

async function reregisterAndWithdrawOtherServices(
  state: Awaited<ReturnType<typeof verifyHistoryAndRestoreNavigation>>,
) {
  const { context, business, page, customer } = state;
  await page.getByRole("button", { name: "会員登録する" }).click();
  await expect(page.getByText("会員登録済みです。", { exact: true })).toBeVisible();
  const newCustomer = await registration(context.request, "customer");
  expect(newCustomer.accountId).not.toBe(customer.accountId);
  expect((await registration(context.request, "business")).accountId).toBe(business.accountId);
  for (const [app, category, label] of [
    ["business", "business", "事業者"],
    ["admin", "operator", "運営"],
  ] as const) {
    await page.goto(`${E2E_SERVER_ORIGINS[app]}/account`);
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole("button", { name: `${label}サービスを退会する` }).click();
    await expect(page.getByRole("heading", { name: `${label}サービスは未登録です` })).toBeVisible();
    expect((await registration(context.request, category)).registered).toBe(false);
    expect(await registration(context.request, "customer")).toEqual(newCustomer);
  }

  return { ...state, newCustomer };
}
