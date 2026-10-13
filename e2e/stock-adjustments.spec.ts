import { expect, test } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";
import type { APIRequestContext } from "@playwright/test";

async function create(request: APIRequestContext, stock = 3) {
  const name = `入荷商品-${crypto.randomUUID()}`;
  const response = await request.post("/api/trpc/product.create", {
    data: { sku: `RECEIPT-${crypto.randomUUID()}`, name, unitPrice: 100, initialStock: stock },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).result.data as { id: string; sku: string; name: string };
}

async function history(request: APIRequestContext, id: string, headers?: Record<string, string>) {
  return request.get(
    `/api/trpc/inventory.history?input=${encodeURIComponent(JSON.stringify({ id }))}`,
    { headers },
  );
}

test("在庫一覧から入荷10個と棚卸しを行い、理由と担当者の履歴を残す", async (props) => {
  const product = await create(props.request);
  await props.page.goto("/organizations/demo-store/inventory");
  await expect(props.page.getByRole("heading", { name: "在庫一覧", exact: true })).toBeVisible();
  const row = props.page.getByRole("row").filter({ hasText: product.name });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "在庫管理", exact: true }).click();
  await expect(props.page.getByLabel("入荷数（個）")).toBeVisible();
  await props.page.getByLabel("入荷数（個）").fill("10");
  await props.page.getByLabel("変更理由").selectOption("delivery");
  await props.page.getByRole("button", { name: "入荷を登録", exact: true }).click();
  const section = props.page.getByRole("region", { name: "入荷・棚卸しの履歴" });
  await expect(section.getByText("3 → 13", { exact: true })).toBeVisible();
  await expect(section.getByText("仕入れ・入荷", { exact: true })).toBeVisible();
  await props.page.getByRole("button", { name: "棚卸し・訂正", exact: true }).click();
  await expect(props.page.getByLabel("棚卸し後の在庫数（個）")).toHaveValue("13");
  await props.page.getByLabel("棚卸し後の在庫数（個）").fill("9");
  await props.page.getByLabel("変更理由").selectOption("damage");
  await props.page.getByRole("button", { name: "棚卸しを反映", exact: true }).click();
  await expect(section.getByText("13 → 9", { exact: true })).toBeVisible();
  await expect(section.getByText("破損・廃棄", { exact: true })).toBeVisible();
  await expect(
    section.getByRole("cell", { name: "デモ管理者", exact: true }).first(),
  ).toBeVisible();
  await props.page.screenshot({
    path: test.info().outputPath("inventory-history-desktop.png"),
    fullPage: true,
  });
  await props.page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => props.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await props.page.screenshot({
    path: test.info().outputPath("inventory-history-mobile.png"),
    fullPage: true,
  });
  await props.page.goto(`${E2E_SERVER_ORIGINS.web}/products/demo-store/${product.sku}`);
  await expect(
    props.page.getByRole("button", { name: "カートに入れる", exact: true }),
  ).toBeEnabled();
});
test("入荷の再送と同時入荷は二重加算や上書きを起こさない", async (props) => {
  const product = await create(props.request);
  const input = {
    id: product.id,
    operationId: crypto.randomUUID(),
    adjustment: { operation: "receive", quantity: 10, reason: "delivery" },
  };
  expect((await props.request.post("/api/trpc/inventory.adjust", { data: input })).status()).toBe(
    200,
  );
  expect((await props.request.post("/api/trpc/inventory.adjust", { data: input })).status()).toBe(
    200,
  );
  const conflict = await props.request.post("/api/trpc/inventory.adjust", {
    data: { ...input, adjustment: { ...input.adjustment, quantity: 20 } },
  });
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).error.data.errorCode).toBe("STOCK_OPERATION_CONFLICT");
  const results = await Promise.all(
    [4, 5].map((quantity) =>
      props.request.post("/api/trpc/inventory.adjust", {
        data: {
          ...input,
          operationId: crypto.randomUUID(),
          adjustment: { ...input.adjustment, quantity },
        },
      }),
    ),
  );
  expect(results.map((response) => response.status())).toEqual([200, 200]);
  const current = await props.request.get(
    `/api/trpc/inventory.get?input=${encodeURIComponent(JSON.stringify({ id: product.id }))}`,
  );
  expect((await current.json()).result.data).toEqual({ onHand: 22, reserved: 0, available: 22 });
  expect((await (await history(props.request, product.id)).json()).result.data).toHaveLength(4);
});
test("一般ユーザー・他企業・実行者偽装から在庫履歴と入荷を保護する", async (props) => {
  const product = await create(props.request);
  const input = {
    id: product.id,
    operationId: crypto.randomUUID(),
    adjustment: { operation: "receive", quantity: 10, reason: "delivery" },
  };
  expect(
    (await history(props.request, product.id, { "x-demo-user": "demo-customer" })).status(),
  ).toBe(403);
  expect(
    (await history(props.request, product.id, { "x-organization-id": "demo-second" })).status(),
  ).toBe(404);
  expect(
    (
      await props.request.post("/api/trpc/inventory.adjust", {
        data: { ...input, actorId: "other" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await props.request.post("/api/trpc/inventory.adjust", {
        headers: { "x-demo-user": "demo-member" },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await props.request.post("/api/trpc/inventory.adjust", {
        headers: { "x-organization-id": "demo-second" },
        data: input,
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await props.request.post("/api/trpc/inventory.adjust", {
        data: { ...input, adjustment: { ...input.adjustment, quantity: 0 } },
      })
    ).status(),
  ).toBe(400);
  expect((await (await history(props.request, product.id)).json()).result.data).toHaveLength(1);
});
test("在庫一覧はスマートフォンでも画面全体を広げず、表の中でスクロールする", async (props) => {
  const product = await create(props.request);
  await props.page.setViewportSize({ width: 1440, height: 900 });
  await props.page.goto("/organizations/demo-store/inventory");
  const row = props.page.getByRole("row").filter({ hasText: product.name });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell")).toHaveText([
    product.name,
    product.sku,
    "3",
    "0",
    "3",
    "在庫管理",
  ]);
  await props.page.screenshot({
    path: test.info().outputPath("inventory-list-desktop.png"),
    fullPage: true,
  });
  await props.page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => props.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(row.getByRole("link", { name: "在庫管理", exact: true })).toBeVisible();
  await props.page.screenshot({
    path: test.info().outputPath("inventory-list-mobile.png"),
    fullPage: true,
  });
});
