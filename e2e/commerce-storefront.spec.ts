import type { Browser, APIRequestContext } from "@playwright/test";
import { z } from "zod";
import { test, expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";
import {
  QUEUE_SETTLEMENT_TIMEOUT_MS,
  QUEUE_SETTLEMENT_POLL_INTERVALS_MS,
  triggerScheduledWork,
} from "@/e2e/scheduled-work";

const customerHeaders = (user: string) => ({ "x-demo-user": user });
const PURCHASE_AND_CANCEL_FLOW_TIMEOUT_MS = 60_000;

test("企業未所属の一般ユーザーが購入・取消・再購入し、履歴を確認できる", async (props) => {
  const prepared = await createStorePurchaseFixture({
    browser: props.browser,
    request: props.request,
  });
  const { sku, name, product, user, context } = prepared;
  try {
    const initialState = {
      browser: props.browser,
      request: props.request,
      sku,
      name,
      product,
      user,
      context,
    };
    const flow0 = await registerIndependentCustomer(initialState);
    const flow1 = await findProductAndAddToCart(flow0);
    const flow2 = await purchaseAndReadHistory(flow1);
    const flow3 = await rejectOtherCustomerCancellation(flow2);
    const flow4 = await confirmPurchaseCancellation(flow3);
    const flow5 = await waitForCancellationAndRepurchase(flow4);
    const flow6 = await rejectCancellationAfterShipment(flow5);
    await verifyPurchaseClearedCart(flow6);
  } finally {
    await context.close();
  }
});

test("公開ストアは顧客登録を要求せず、販売者の管理操作を表示しない", async (props) => {
  const context = await props.browser.newContext({
    extraHTTPHeaders: customerHeaders(`unregistered-browser-${crypto.randomUUID()}`),
  });
  try {
    const page = await context.newPage();
    await page.goto(E2E_SERVER_ORIGINS.web);
    await expect(page.getByRole("heading", { name: "すべての商品", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "出荷する", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("SKU", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("単価（円）", { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("公開商品APIは認証なしで読めるが、購入は登録済み本人に限定して価格改ざんを拒否する", async (props) => {
  const prepared = await createPublicStoreClient({
    playwright: props.playwright,
    request: props.request,
  });
  const { publicClient } = prepared;
  try {
    const initialState = { playwright: props.playwright, request: props.request, publicClient };
    const flow0 = await seedPublicPricingProducts(initialState);
    const flow1 = await rejectUnregisteredPurchase(flow0);
    await verifyPaidAndFreePricing(flow1);
  } finally {
    await publicClient.dispose();
  }
});

async function createStorePurchaseFixture(state: { browser: Browser; request: APIRequestContext }) {
  const { browser, request } = state;
  test.setTimeout(PURCHASE_AND_CANCEL_FLOW_TIMEOUT_MS);
  const sku = `STORE-${crypto.randomUUID()}`;
  const name = `ストア購入-${crypto.randomUUID()}`;
  const product = await request.post("/api/trpc/product.create", {
    data: { sku, name, unitPrice: 1200, initialStock: 2 },
  });
  expect(product.status()).toBe(200);
  const user = `store-customer-${crypto.randomUUID()}`;
  const context = await browser.newContext({
    extraHTTPHeaders: customerHeaders(user),
  });
  return { ...state, sku, name, product, user, context };
}

async function registerIndependentCustomer(
  state: Awaited<ReturnType<typeof createStorePurchaseFixture>>,
) {
  const { context } = state;
  const registered = await context.request.post(
    `${E2E_SERVER_ORIGINS.web}/api/trpc/access.registerCustomer`,
    {
      data: { service: "customer", name: "一般購入者" },
    },
  );
  expect(registered.status()).toBe(200);
  const accountId = z
    .object({
      result: z.object({ data: z.object({ accountId: z.string() }) }),
    })
    .parse(await registered.json()).result.data.accountId;
  return { ...state, registered, accountId };
}

async function findProductAndAddToCart(
  state: Awaited<ReturnType<typeof registerIndependentCustomer>>,
) {
  const { sku, name, context } = state;
  expect(
    (
      await context.request.post(`${E2E_SERVER_ORIGINS.web}/api/trpc/access.changeCustomerPlan`, {
        data: { planCode: "customer:demo" },
      })
    ).status(),
  ).toBe(200);
  const session = await context.request.get(`${E2E_SERVER_ORIGINS.web}/api/trpc/access.session`, {
    params: { input: JSON.stringify({ service: "customer" }) },
  });
  expect((await session.json()).result.data.organizations).toEqual([]);
  const page = await context.newPage();
  await page.goto(`${E2E_SERVER_ORIGINS.web}/?q=${encodeURIComponent(name)}`);
  await page.getByRole("article").filter({ hasText: name }).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/products/demo-store/${sku}$`));
  await page.getByRole("button", { name: "カートに入れる", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("カートに追加しました");
  await page.getByRole("link", { name: "カートを確認する" }).click();
  return { ...state, session, page };
}

async function purchaseAndReadHistory(state: Awaited<ReturnType<typeof findProductAndAddToCart>>) {
  const { request, name, page } = state;
  await expect(page.getByRole("heading", { name: "ショッピングカート" })).toBeVisible();
  await page.getByLabel(`${name}の数量`, { exact: true }).fill("2");
  await page.reload();
  await expect(page.getByLabel(`${name}の数量`, { exact: true })).toHaveValue("2");
  await page.getByRole("link", { name: "購入手続きへ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "購入内容の確認" })).toBeVisible();
  await page.getByRole("button", { name: "注文を確定する", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ご注文ありがとうございます" })).toBeVisible();
  await expect(page.getByRole("main").getByText("￥2,400", { exact: true }).first()).toBeVisible();
  const orderId = new URL(page.url()).pathname.split("/")[2]!;
  const other = await request.get(`${E2E_SERVER_ORIGINS.web}/api/trpc/store.getOrder`, {
    headers: customerHeaders("demo-customer"),
    params: { input: JSON.stringify({ id: orderId }) },
  });
  expect(other.status()).toBe(404);
  await page.getByRole("link", { name: "注文履歴へ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "注文履歴", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(name);
  await page.getByRole("link", { name: "注文の詳細を見る", exact: true }).click();
  return { ...state, orderId, other };
}

async function rejectOtherCustomerCancellation(
  state: Awaited<ReturnType<typeof purchaseAndReadHistory>>,
) {
  const { request, context, page, orderId } = state;
  const owned = await context.request.get(`${E2E_SERVER_ORIGINS.web}/api/trpc/store.getOrder`, {
    params: { input: JSON.stringify({ id: orderId }) },
  });
  expect(owned.status()).toBe(200);
  const version = z
    .object({ result: z.object({ data: z.object({ version: z.number() }) }) })
    .parse(await owned.json()).result.data.version;
  const otherCancellation = await request.post(
    `${E2E_SERVER_ORIGINS.web}/api/trpc/store.cancelOrder`,
    {
      headers: customerHeaders("demo-customer"),
      data: { id: orderId, version },
    },
  );
  expect(otherCancellation.status()).toBe(404);
  await page.getByRole("button", { name: "注文を取り消す", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(
    confirmation.getByRole("heading", { name: "この注文を取り消しますか？" }),
  ).toBeVisible();
  await confirmation.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.getByRole("button", { name: "注文を取り消す", exact: true })).toBeVisible();
  return { ...state, owned, version, otherCancellation, confirmation };
}

async function confirmPurchaseCancellation(
  state: Awaited<ReturnType<typeof rejectOtherCustomerCancellation>>,
) {
  const { request, page, confirmation } = state;
  await page.getByRole("button", { name: "注文を取り消す", exact: true }).click();
  await confirmation.getByRole("button", { name: "注文の取消を確定する", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole("main").getByText("キャンセル済み", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "注文を取り消す", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "注文履歴へ", exact: true }).click();
  await expect(page.getByRole("main").getByText("キャンセル済み", { exact: true })).toBeVisible();
  await triggerScheduledWork(request);
  return { ...state };
}

async function waitForCancellationAndRepurchase(
  state: Awaited<ReturnType<typeof confirmPurchaseCancellation>>,
) {
  const { request, sku, name, context, orderId } = state;
  await expect
    .poll(
      async () => {
        const response = await request.get("/api/trpc/order.get", {
          params: { input: JSON.stringify({ service: "business", id: orderId }) },
        });
        expect(response.status()).toBe(200);
        return z
          .object({
            result: z.object({ data: z.object({ paymentStatus: z.string().nullable() }) }),
          })
          .parse(await response.json()).result.data.paymentStatus;
      },
      { timeout: QUEUE_SETTLEMENT_TIMEOUT_MS, intervals: QUEUE_SETTLEMENT_POLL_INTERVALS_MS },
    )
    .toBe("voided");
  const repurchased = await context.request.post(
    `${E2E_SERVER_ORIGINS.web}/api/trpc/store.checkout`,
    {
      data: { tenantId: "demo-store", lines: [{ sku, name, quantity: 1, unitPrice: 1200 }] },
    },
  );
  return { ...state, repurchased };
}

async function rejectCancellationAfterShipment(
  state: Awaited<ReturnType<typeof waitForCancellationAndRepurchase>>,
) {
  const { request, context, page, repurchased } = state;
  expect(repurchased.status()).toBe(200);
  const repurchase = z
    .object({ result: z.object({ data: z.object({ id: z.string(), version: z.number() }) }) })
    .parse(await repurchased.json()).result.data;
  const shipped = await request.post("/api/trpc/order.transition", {
    data: { service: "business", ...repurchase, status: "shipped" },
  });
  expect(shipped.status()).toBe(200);
  const shippedVersion = z
    .object({ result: z.object({ data: z.object({ version: z.number() }) }) })
    .parse(await shipped.json()).result.data.version;
  expect(
    (
      await context.request.post(`${E2E_SERVER_ORIGINS.web}/api/trpc/store.cancelOrder`, {
        data: { id: repurchase.id, version: shippedVersion },
      })
    ).status(),
  ).toBe(409);
  await page.goto(`${E2E_SERVER_ORIGINS.web}/orders/${repurchase.id}`);
  await expect(page.getByRole("main").getByText("発送済み", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "注文を取り消す", exact: true })).toHaveCount(0);
  await page.goto(`${E2E_SERVER_ORIGINS.web}/cart`);
  return { ...state, repurchase, shipped, shippedVersion };
}

async function verifyPurchaseClearedCart(
  state: Awaited<ReturnType<typeof rejectCancellationAfterShipment>>,
) {
  const { page } = state;
  await expect(page.getByRole("heading", { name: "カートは空です" })).toBeVisible();
  return { ...state };
}

async function createPublicStoreClient(state: {
  playwright: Pick<typeof import("@playwright/test"), "request">;
  request: APIRequestContext;
}) {
  const { playwright } = state;
  const publicClient = await playwright.request.newContext({
    baseURL: E2E_SERVER_ORIGINS.api,
  });
  return { ...state, publicClient };
}

async function seedPublicPricingProducts(
  state: Awaited<ReturnType<typeof createPublicStoreClient>>,
) {
  const { request, publicClient } = state;
  const list = await publicClient.get("/api/trpc/store.list", {
    params: { input: JSON.stringify({ limit: 10 }) },
  });
  expect(list.status()).toBe(200);
  const suffix = crypto.randomUUID();
  const paidSku = `STORE-PAID-${suffix}`;
  const freeSku = `STORE-FREE-${suffix}`;
  for (const [sku, unitPrice] of [
    [paidSku, 1500],
    [freeSku, 0],
  ] as const) {
    expect(
      (
        await request.post("/api/trpc/product.create", {
          data: { sku, name: sku, unitPrice, initialStock: 5 },
        })
      ).status(),
    ).toBe(200);
  }

  return { ...state, list, suffix, paidSku, freeSku };
}

async function rejectUnregisteredPurchase(
  state: Awaited<ReturnType<typeof seedPublicPricingProducts>>,
) {
  const { publicClient, freeSku } = state;
  const data = (sku: string, unitPrice: number) => ({
    tenantId: "demo-store",
    lines: [{ sku, name: "入力した商品名", quantity: 1, unitPrice }],
  });
  const unregistered = await publicClient.post("/api/trpc/store.checkout", {
    headers: customerHeaders(`unregistered-checkout-${crypto.randomUUID()}`),
    data: data(freeSku, 0),
  });
  expect(unregistered.status()).toBe(403);
  return { ...state, data, unregistered };
}

async function verifyPaidAndFreePricing(
  state: Awaited<ReturnType<typeof rejectUnregisteredPurchase>>,
) {
  const { publicClient, paidSku, freeSku, data } = state;
  const tampered = await publicClient.post("/api/trpc/store.checkout", {
    headers: customerHeaders("demo-customer"),
    data: data(paidSku, 0),
  });
  expect(tampered.status()).toBe(400);
  const free = await publicClient.post("/api/trpc/store.checkout", {
    headers: customerHeaders("demo-customer"),
    data: data(freeSku, 0),
  });
  expect(free.status()).toBe(200);
  expect((await free.json()).result.data.total).toBe(0);
  return { ...state, tampered, free };
}
