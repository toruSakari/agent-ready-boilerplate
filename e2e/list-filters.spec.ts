import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";
import { createCustomerOrder } from "@/e2e/customer-order-fixture";

const EMPTY_RESULT = "該当する結果はありません。検索条件を変更してください。";
const FILTER_FLOW_TIMEOUT_MS = 90_000;

async function product(
  request: APIRequestContext,
  name: string,
  initialStock = 3,
  unitPrice = 100,
) {
  const response = await request.post("/api/trpc/product.create", {
    data: { sku: `FILTER-${crypto.randomUUID()}`, name, initialStock, unitPrice },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).result.data as { id: string; sku: string; name: string };
}

async function search(page: Page, label: string, value: string, submitLabel = "絞り込む") {
  await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await page.getByRole("button", { name: submitLabel, exact: true }).click();
}

async function query(
  request: APIRequestContext,
  path: string,
  input: unknown,
  headers?: Record<string, string>,
) {
  return request.get(`/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`, {
    headers,
  });
}

test("商品検索は後続ページの対象を見つけ、条件変更で先頭に戻りURLと詳細から復元する", async (props) => {
  test.setTimeout(FILTER_FLOW_TIMEOUT_MS);
  const target = await product(props.request, `検索対象-${crypto.randomUUID()}`);
  const prefix = `検索ページ-${crypto.randomUUID()}`;
  for (let index = 0; index < 26; index++) {
    await product(props.request, `${prefix}-${index}`);
  }

  await props.page.goto("/organizations/demo-store/products");
  const row = props.page.getByRole("row").filter({ hasText: target.name });
  await expect(row).toHaveCount(0);
  await props.page
    .getByLabel("商品のページ切替")
    .getByRole("button", { name: "次へ", exact: true })
    .click();
  await expect(row).toBeVisible();
  await search(props.page, "商品名・SKUを検索", target.name);
  await expect(props.page).toHaveURL(new RegExp(`q=${encodeURIComponent(target.name)}`));
  await expect(props.page.getByLabel("商品のページ切替")).toContainText("1ページ");
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "詳細を見る", exact: true }).click();
  await props.page.goBack();
  await expect(
    props.page.getByRole("textbox", { name: "商品名・SKUを検索", exact: true }),
  ).toHaveValue(target.name);
  await props.page.reload();
  await expect(row).toBeVisible();
  await props.page.getByRole("button", { name: "条件を解除", exact: true }).click();
  await expect(props.page).not.toHaveURL(/q=/);
  await expect(
    props.page.getByRole("textbox", { name: "商品名・SKUを検索", exact: true }),
  ).toHaveValue("");
});
test("在庫の検索と状態を併用し、該当なしを解除できる", async (props) => {
  const prefix = `在庫条件-${crypto.randomUUID()}`;
  const empty = await product(props.request, `${prefix}-ゼロ`, 0);
  const stocked = await product(props.request, `${prefix}-あり`, 2);
  await props.page.goto("/organizations/demo-store/inventory");
  await search(props.page, "商品名・SKUを検索", prefix);
  await props.page.getByRole("button", { name: "在庫切れ", exact: true }).click();
  await expect(props.page.getByRole("row").filter({ hasText: empty.name })).toBeVisible();
  await expect(props.page.getByRole("row").filter({ hasText: stocked.name })).toHaveCount(0);
  await props.page.getByRole("button", { name: "在庫あり", exact: true }).click();
  await expect(props.page.getByRole("row").filter({ hasText: stocked.name })).toBeVisible();
  await search(props.page, "商品名・SKUを検索", empty.name);
  await expect(props.page.getByText(EMPTY_RESULT, { exact: true })).toBeVisible();
  await props.page.getByRole("button", { name: "すべて", exact: true }).click();
  await expect(props.page.getByRole("row").filter({ hasText: empty.name })).toBeVisible();
});

async function order(request: APIRequestContext, draft = false, user = "demo-customer") {
  return createCustomerOrder(
    request,
    [
      {
        sku: `ORDER-FILTER-${crypto.randomUUID()}`,
        name: "絞り込み用注文",
        quantity: 1,
        unitPrice: 100,
      },
    ],
    { draft, user },
  );
}

test("企業注文は番号・状態・注文日で絞り、詳細から戻っても条件が残る", async (props) => {
  const confirmed = await order(props.request);
  await props.page.goto("/organizations/demo-store/orders");
  await search(props.page, "注文番号を検索", confirmed.id);
  await props.page.getByRole("button", { name: "発送済み", exact: true }).click();
  await expect(props.page.getByText(EMPTY_RESULT, { exact: true })).toBeVisible();
  await props.page.getByRole("button", { name: "発送待ち", exact: true }).click();
  const row = props.page.getByRole("row").filter({ hasText: confirmed.id });
  await expect(row).toBeVisible();
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  await props.page.getByLabel("開始日", { exact: true }).fill(date);
  await props.page.getByLabel("終了日", { exact: true }).fill(date);
  await props.page.getByRole("button", { name: "絞り込む", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "詳細を見る", exact: true }).click();
  await props.page.goBack();
  await expect(props.page.getByRole("button", { name: "発送待ち", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(props.page.getByLabel("開始日", { exact: true })).toHaveValue(date);
});
test("本人注文の状態・番号検索は他会員の注文を表示しない", async (props) => {
  const mine = await order(props.request, true);
  const other = await order(props.request, true, "demo-user");
  const context = await props.browser.newContext({
    extraHTTPHeaders: { "x-demo-user": "demo-customer" },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${E2E_SERVER_ORIGINS.web}/orders`);
    await page.getByRole("button", { name: "下書き", exact: true }).click();
    await search(page, "注文番号を検索", mine.id);
    await expect(page.getByRole("link", { name: "注文の詳細を見る", exact: true })).toBeVisible();
    await search(page, "注文番号を検索", other.id);
    await expect(page.getByText(EMPTY_RESULT, { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
test("公開商品は在庫と0円の価格条件を併用してURLから復元する", async (props) => {
  const prefix = `価格条件-${crypto.randomUUID()}`;
  const free = await product(props.request, `${prefix}-無料`, 2, 0);
  const paid = await product(props.request, `${prefix}-有料`, 2, 100);
  await props.page.goto(`${E2E_SERVER_ORIGINS.web}/?q=${encodeURIComponent(prefix)}`);
  await props.page.getByLabel("最低価格（円）").fill("0");
  await props.page.getByLabel("最高価格（円）").fill("0");
  await props.page.getByLabel("並び替え", { exact: true }).selectOption("oldest");
  await props.page.getByRole("button", { name: "絞り込む", exact: true }).click();
  await props.page.getByRole("button", { name: "在庫あり", exact: true }).click();
  await expect(props.page.getByRole("heading", { name: free.name, exact: true })).toBeVisible();
  await expect(props.page.getByRole("heading", { name: paid.name, exact: true })).toHaveCount(0);
  await props.page.reload();
  await expect(props.page.getByLabel("最低価格（円）")).toHaveValue("0");
  await expect(props.page.getByLabel("並び替え", { exact: true })).toHaveValue("oldest");
  await expect(props.page.getByRole("heading", { name: free.name, exact: true })).toBeVisible();
});

async function organization(request: APIRequestContext, name: string, active: boolean) {
  const created = await request.post(
    `${E2E_SERVER_ORIGINS.admin}/api/trpc/access.createOrganization`,
    { data: { name } },
  );
  expect(created.status()).toBe(200);
  const id = (await created.json()).result.data.id as string;
  const updated = await request.post(
    `${E2E_SERVER_ORIGINS.admin}/api/trpc/access.updateOrganization`,
    { data: { id, name, active, invitationsEnabled: false } },
  );
  expect(updated.status()).toBe(200);
  return id;
}

test("運営企業一覧は企業名・利用状態・契約プランで全対象を検索する", async (props) => {
  const prefix = `企業条件-${crypto.randomUUID()}`;
  const activeName = `${prefix}-利用中`;
  const inactiveName = `${prefix}-停止`;
  const id = await organization(props.request, activeName, true);
  await organization(props.request, inactiveName, false);
  const assigned = await props.request.post(
    `${E2E_SERVER_ORIGINS.admin}/api/trpc/access.assignPlan`,
    {
      data: { category: "business", id, planCode: "business:demo" },
    },
  );
  expect(assigned.status()).toBe(200);
  await props.page.goto(`${E2E_SERVER_ORIGINS.admin}/organizations`);
  await search(props.page, "企業名を検索", prefix);
  await props.page.getByRole("button", { name: "利用停止", exact: true }).click();
  await expect(props.page.getByText(inactiveName, { exact: true })).toBeVisible();
  await expect(props.page.getByText(activeName, { exact: true })).toHaveCount(0);
  await props.page.getByRole("button", { name: "利用中", exact: true }).click();
  await props.page.getByLabel("契約プラン", { exact: true }).selectOption("business:demo");
  await props.page.getByRole("button", { name: "絞り込む", exact: true }).click();
  await expect(props.page.getByText(activeName, { exact: true })).toBeVisible();
  await props.page.getByLabel("契約プラン", { exact: true }).selectOption("unassigned");
  await props.page.getByRole("button", { name: "絞り込む", exact: true }).click();
  await expect(props.page.getByText("該当する企業はありません。", { exact: true })).toBeVisible();
});
test("不正な一覧条件をAPIが拒否し、他企業の検索結果を返さない", async (props) => {
  expect(
    (await query(props.request, "order.list", { service: "business", status: "paid" })).status(),
  ).toBe(400);
  expect((await query(props.request, "store.list", { minPrice: -1 })).status()).toBe(400);
  expect(
    (
      await query(props.request, "order.list", {
        service: "business",
        from: "2026-10-12",
        to: "2026-10-11",
      })
    ).status(),
  ).toBe(400);
  const own = await product(props.request, `企業分離-${crypto.randomUUID()}`);
  const result = await query(
    props.request,
    "product.list",
    { service: "business", search: own.name },
    { "x-organization-id": "demo-second" },
  );
  expect(result.status()).toBe(200);
  expect((await result.json()).result.data).toEqual([]);
});
test("取得失敗中も検索条件を変更でき、条件変更で一覧が復旧する", async (props) => {
  const target = await product(props.request, `復旧-${crypto.randomUUID()}`);
  await props.page.route("**/api/trpc/product.list**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await props.page.goto("/organizations/demo-store/products");
  await expect(props.page.getByRole("alert")).toBeVisible();
  await expect(
    props.page.getByRole("textbox", { name: "商品名・SKUを検索", exact: true }),
  ).toBeVisible();
  await props.page.unroute("**/api/trpc/product.list**");
  await search(props.page, "商品名・SKUを検索", target.name);
  await expect(props.page.getByRole("row").filter({ hasText: target.name })).toBeVisible();
  await expect(props.page.getByRole("alert")).toHaveCount(0);
});
test("モバイル・ダーク・英語でもフィルターが横にはみ出さない", async (props) => {
  await props.page.setViewportSize({ width: 390, height: 844 });
  await props.page
    .context()
    .addCookies([{ name: "dev-template-locale", value: "en", url: E2E_SERVER_ORIGINS.business }]);
  await props.page.goto("/organizations/demo-store/orders");
  await props.page.getByRole("button", { name: "Choose a theme", exact: true }).click();
  await props.page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(props.page.locator("html")).toHaveClass(/dark/);
  await expect(props.page.getByLabel("Filter list", { exact: true })).toBeVisible();
  await expect
    .poll(() => props.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(props.page.getByRole("button", { name: "Cancelled", exact: true })).toBeVisible();
  await search(
    props.page,
    "Search order number",
    `missing-${crypto.randomUUID()}`,
    "Apply filters",
  );
  await expect(
    props.page.getByText("No matching results. Try changing your filters.", { exact: true }),
  ).toBeVisible();
  await props.page.screenshot({
    path: test.info().outputPath("order-filters-mobile-dark-en.png"),
    fullPage: true,
  });
});
