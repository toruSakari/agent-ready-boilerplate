import { createCustomerOrder } from "@/e2e/customer-order-fixture";
import type { APIRequestContext, Page } from "@playwright/test";
import { QUEUE_SETTLEMENT_TIMEOUT_MS, triggerScheduledWork } from "@/e2e/scheduled-work";
import { execFileSync } from "node:child_process";
import { expect, test } from "@/e2e/fixtures";

const INVENTORY_POLL_INTERVALS_MS = [250, 500, 1_000];
const ORDER_LIFECYCLE_TIMEOUT_MS = 60_000;

function seedStock() {
  const sku = `SKU-E2E-${crypto.randomUUID()}`;
  return sku;
}

function stock(sku: string, tenantId = "demo-store") {
  const output = execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "--config",
      "apps/api/wrangler.jsonc",
      "d1",
      "execute",
      "DB",
      "--local",
      "--json",
      "--command",
      `SELECT on_hand FROM inventory_items WHERE sku = '${sku}' AND tenant_id = '${tenantId}'`,
    ],
    { encoding: "utf8", stdio: "pipe" },
  );
  const result = JSON.parse(output) as { results: { on_hand: number }[] }[];
  return result[0]!.results[0]!.on_hand;
}

async function expectStock(sku: string, expected: number) {
  // Queue反映と並列テストが同じローカルD1を使うため、固定sleepではなく台帳の値を待つ。
  await expect(() => expect(stock(sku)).toBe(expected)).toPass({
    timeout: QUEUE_SETTLEMENT_TIMEOUT_MS,
    intervals: INVENTORY_POLL_INTERVALS_MS,
  });
}

function observeBrowserErrors(page: Page) {
  page.on("pageerror", (error) => console.error("ブラウザーの実行エラー:", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error("ブラウザーのコンソールエラー:", message.text());
    }
  });
}

test("一般ユーザーの注文を企業が受注し、合計金額と確定状態を表示する", async (props) => {
  observeBrowserErrors(props.page);
  const sku = seedStock();
  const name = `注文テスト-${crypto.randomUUID()}`;
  const created = await createCustomerOrder(props.request, [
    { sku, name, quantity: 2, unitPrice: 2400 },
  ]);
  await props.page.goto(`/organizations/demo-store/orders/${created.id}`);
  const order = props.page.getByRole("article").filter({ hasText: name });
  await expect(order).toHaveCount(1);
  await expect(order.getByText("￥4,800", { exact: true })).toBeVisible();
  await expect(order.getByText("確定", { exact: true })).toBeVisible();
});

test("下書きを編集し、確定してキャンセルする", async (props) => {
  observeBrowserErrors(props.page);
  // 確定と取消のQueue配信・画面再取得を両方含むため、このフローの待機上限を分ける。
  test.setTimeout(ORDER_LIFECYCLE_TIMEOUT_MS);
  const sku = seedStock();
  const name = `変更テスト-${crypto.randomUUID()}`;
  const created = await createCustomerOrder(
    props.request,
    [{ sku, name, quantity: 1, unitPrice: 2400 }],
    { draft: true },
  );
  await props.page.goto(`/organizations/demo-store/orders/${created.id}`);
  const order = props.page.getByRole("article").filter({ hasText: name });
  await expect(order.getByText("下書き", { exact: true })).toBeVisible();
  await order.getByRole("button", { name: "明細を編集" }).click();
  await order.getByRole("button", { name: "明細を追加" }).click();
  const added = order.locator("fieldset").nth(1);
  await added.getByLabel("SKU", { exact: true }).fill(` ${sku} `);
  await added.getByLabel("商品名", { exact: true }).fill("追加商品");
  await order.getByRole("button", { name: "変更を保存" }).click();
  await expect(order.getByRole("alert")).toHaveText("同じSKUの明細は一つにまとめてください");
  await added.getByRole("button", { name: "明細を削除" }).click();
  await order.getByLabel("数量", { exact: true }).fill("3");
  await order.getByRole("button", { name: "変更を保存" }).click();
  await expect(order.getByText("￥7,200", { exact: true })).toBeVisible();
  await order.getByRole("button", { name: "注文を確定" }).click();
  await expect(order.getByText("確定", { exact: true })).toBeVisible();
  await triggerScheduledWork(props.page.request);
  await expect(order.getByText("デモ決済：承認済み", { exact: true })).toBeVisible({
    timeout: QUEUE_SETTLEMENT_TIMEOUT_MS,
  });
  await expectStock(sku, 17);
  await order.getByRole("button", { name: "注文をキャンセル" }).click();
  await expect(order.getByText("キャンセル済み", { exact: true })).toBeVisible();
  await triggerScheduledWork(props.page.request);
  await expect(order.getByText("デモ決済：取消済み", { exact: true })).toBeVisible({
    timeout: QUEUE_SETTLEMENT_TIMEOUT_MS,
  });
  await expectStock(sku, 20);
  await expect(order.getByRole("button", { name: "出荷する" })).toHaveCount(0);
});

test("出荷・完了へ進め、出荷後のキャンセル操作を表示しない", async (props) => {
  observeBrowserErrors(props.page);
  test.setTimeout(ORDER_LIFECYCLE_TIMEOUT_MS);
  const sku = seedStock();
  const name = `出荷テスト-${crypto.randomUUID()}`;
  const created = await createCustomerOrder(props.request, [
    { sku, name, quantity: 1, unitPrice: 2400 },
  ]);
  await props.page.goto(`/organizations/demo-store/orders/${created.id}`);
  const order = props.page.getByRole("article").filter({ hasText: name });
  await order.getByRole("button", { name: "出荷する" }).click();
  await expect(order.getByText("出荷済み", { exact: true })).toBeVisible();
  await expect(order.getByRole("button", { name: "注文をキャンセル" })).toHaveCount(0);
  await order.getByRole("button", { name: "注文を完了" }).click();
  await expect(order.getByText("完了", { exact: true })).toBeVisible();
  await triggerScheduledWork(props.page.request);
  await expect(order.getByText("デモ決済：売上確定", { exact: true })).toBeVisible({
    timeout: QUEUE_SETTLEMENT_TIMEOUT_MS,
  });
  await expectStock(sku, 19);
});

test("注文編集の権限・テナント・古い更新番号をAPIで拒否する", async (props) => {
  const lines = [
    {
      sku: `SKU-PERMISSION-${crypto.randomUUID()}`,
      name: "権限テスト",
      quantity: 1,
      unitPrice: 100,
    },
  ];
  const order = await createCustomerOrder(props.request, lines, { draft: true });
  const data = {
    service: "business",
    id: order.id,
    version: order.version,
    lines: [{ ...lines[0]!, quantity: 2 }],
  };
  const member = await props.request.post("/api/trpc/order.update", {
    headers: { "x-demo-role": "member" },
    data,
  });
  expect(member.status()).toBe(403);
  const other = await props.request.post("/api/trpc/order.update", {
    headers: { "x-organization-id": "demo-second" },
    data,
  });
  expect(other.status()).toBe(404);
  const updated = await props.request.post("/api/trpc/order.update", { data });
  expect(updated.status()).toBe(200);
  const stale = await props.request.post("/api/trpc/order.update", { data });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.message).toBe("注文が更新されています。再読み込みしてください");
});

test("同じSKUの在庫を企業別のDOで予約・確定・取消する", async (props) => {
  const initialState = { request: props.request };
  const flow0 = await seedTenantInventory(initialState);
  const flow1 = await createSecondTenantOrder(flow0);
  const flow2 = await cancelSecondTenantReservation(flow1);
  await verifyTenantInventoryIsolation(flow2);
});

async function seedTenantInventory(state: { request: APIRequestContext }) {
  const { request } = state;
  test.setTimeout(ORDER_LIFECYCLE_TIMEOUT_MS);
  const sku = `SKU-TENANT-${crypto.randomUUID()}`;
  const first = await createCustomerOrder(
    request,
    [{ sku, name: "企業A", quantity: 1, unitPrice: 100 }],
    { initialStock: 10 },
  );
  return { ...state, sku, first };
}

async function createSecondTenantOrder(state: Awaited<ReturnType<typeof seedTenantInventory>>) {
  const { request, sku } = state;
  const second = await createCustomerOrder(
    request,
    [{ sku, name: "企業B", quantity: 2, unitPrice: 100 }],
    { organizationId: "demo-second" },
  );
  const order = second;
  await triggerScheduledWork(request);
  return { ...state, second, order };
}

async function cancelSecondTenantReservation(
  state: Awaited<ReturnType<typeof createSecondTenantOrder>>,
) {
  const { request, sku, order } = state;
  await expect(() => {
    expect(stock(sku, "demo-store")).toBe(9);
    expect(stock(sku, "demo-second")).toBe(18);
  }).toPass({
    timeout: QUEUE_SETTLEMENT_TIMEOUT_MS,
    intervals: INVENTORY_POLL_INTERVALS_MS,
  });
  const cancelled = await request.post("/api/trpc/order.transition", {
    headers: { "x-organization-id": "demo-second" },
    data: {
      service: "business",
      id: order.id,
      version: order.version,
      status: "cancelled",
    },
  });
  expect(cancelled.status()).toBe(200);
  await triggerScheduledWork(request);
  return { ...state, cancelled };
}

async function verifyTenantInventoryIsolation(
  state: Awaited<ReturnType<typeof cancelSecondTenantReservation>>,
) {
  const { sku } = state;
  await expect(() => {
    expect(stock(sku, "demo-store")).toBe(9);
    expect(stock(sku, "demo-second")).toBe(20);
  }).toPass({
    timeout: QUEUE_SETTLEMENT_TIMEOUT_MS,
    intervals: INVENTORY_POLL_INTERVALS_MS,
  });
  return { ...state };
}
