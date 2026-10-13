import type { Page, APIRequestContext } from "@playwright/test";
import { test, expect } from "@/e2e/fixtures";

const ADMIN_ORIGIN = "http://127.0.0.1:5175";
const BUSINESS_ORIGIN = "http://127.0.0.1:5174";
const CUSTOMER_ORIGIN = "http://127.0.0.1:5173";
const ORGANIZATION_ID = "demo-second";

test("運営画面から企業IP制限を設定し、企業APIの拒否と解除を確認する", async (props) => {
  const prepared = await resetBusinessIpPolicy({ page: props.page, request: props.request });
  const { reset } = prepared;
  try {
    const initialState = { page: props.page, request: props.request, reset };
    const flow0 = await configureAndRejectBusinessAccess(initialState);
    const flow1 = await verifyIpAndAccountBoundaries(flow0);
    await clearPolicyAndVerifyRecovery(flow1);
  } finally {
    expect((await reset()).status()).toBe(200);
  }
});

async function resetBusinessIpPolicy(state: { page: Page; request: APIRequestContext }) {
  const { request } = state;
  const reset = () =>
    request.post(`${ADMIN_ORIGIN}/api/trpc/access.updateBusinessIpPolicy`, {
      data: { id: ORGANIZATION_ID, enabled: false, allowedIps: [] },
    });
  expect((await reset()).status()).toBe(200);
  return { ...state, reset };
}

async function configureAndRejectBusinessAccess(
  state: Awaited<ReturnType<typeof resetBusinessIpPolicy>>,
) {
  const { page, request } = state;
  await page.goto(`${ADMIN_ORIGIN}/organizations/${ORGANIZATION_ID}/ip-settings`);
  await page.getByLabel("企業画面のIP制限を有効にする").check();
  await page.getByLabel("許可IP・CIDR（1行に1件）").fill("203.0.113.0/24\n2001:db8::/32");
  await page.getByRole("button", { name: "IP制限を保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("IP制限を保存しました");
  await page.reload();
  await expect(page.getByLabel("企業画面のIP制限を有効にする")).toBeChecked();
  const params = { input: JSON.stringify({ service: "business" }) };
  const headers = {
    "x-organization-id": ORGANIZATION_ID,
    "x-forwarded-for": "203.0.113.5",
  };
  const denied = await request.get(`${BUSINESS_ORIGIN}/api/trpc/order.list`, {
    params,
    headers,
  });
  expect(denied.status()).toBe(403);
  expect(await denied.text()).toContain("このIPアドレスからは企業画面を利用できません");
  const direct = await request.get(`http://127.0.0.1:8787/api/trpc/order.list`, {
    params,
    headers,
  });
  return { ...state, params, headers, denied, direct };
}

async function verifyIpAndAccountBoundaries(
  state: Awaited<ReturnType<typeof configureAndRejectBusinessAccess>>,
) {
  const { page, request, params, headers, direct } = state;
  expect(direct.status()).toBe(403);
  const allowed = await request.get("http://127.0.0.1:8787/api/trpc/order.list", {
    params,
    headers: { ...headers, "cf-connecting-ip": "203.0.113.25" },
  });
  expect(allowed.status()).toBe(200);
  const customer = await request.get(`${CUSTOMER_ORIGIN}/api/trpc/order.list`, {
    params: { input: JSON.stringify({ service: "customer" }) },
    headers,
  });
  expect(customer.status()).toBe(200);
  const forbidden = await request.post(
    `${BUSINESS_ORIGIN}/api/trpc/access.updateBusinessIpPolicy`,
    {
      data: { id: ORGANIZATION_ID, enabled: false, allowedIps: [] },
      headers: { "x-demo-user": "demo-member" },
    },
  );
  expect(forbidden.status()).toBe(403);
  const company = await page.context().newPage();
  await company.goto(`${BUSINESS_ORIGIN}/organizations/${ORGANIZATION_ID}`);
  return { ...state, allowed, customer, forbidden, company };
}

async function clearPolicyAndVerifyRecovery(
  state: Awaited<ReturnType<typeof verifyIpAndAccountBoundaries>>,
) {
  const { page, request, params, headers, company } = state;
  await expect(
    company.getByRole("heading", {
      name: "この画面を利用する権限がありません",
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(company.getByRole("button", { name: "注文する" })).toHaveCount(0);
  await company.close();
  await page.getByLabel("企業画面のIP制限を有効にする").uncheck();
  await page.getByRole("button", { name: "IP制限を保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("IP制限を保存しました");
  expect(
    (
      await request.get(`${BUSINESS_ORIGIN}/api/trpc/order.list`, {
        params,
        headers,
      })
    ).status(),
  ).toBe(200);
  return { ...state };
}
