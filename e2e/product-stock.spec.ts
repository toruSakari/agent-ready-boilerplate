import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

test("商品登録で初期在庫を指定し、商品詳細の補充をストアへ反映する", async (props) => {
  const { sku, id } = await registerStockProduct(props.page);
  const available = await props.request.get(
    `/api/trpc/store.get?input=${encodeURIComponent(JSON.stringify({ tenantId: "demo-store", sku }))}`,
  );
  expect(available.status()).toBe(200);
  expect((await available.json()).result.data.availableQuantity).toBe(3);
  await props.page.getByLabel("棚卸し後の在庫数（個）").fill("0");
  await props.page.getByRole("button", { name: "棚卸しを反映", exact: true }).click();
  await expect.poll(() => currentStock(props.request, id)).toBe(0);
  await props.page.getByRole("button", { name: "入荷", exact: true }).click();
  await props.page.getByLabel("入荷数（個）").fill("5");
  await props.page.getByRole("button", { name: "入荷を登録", exact: true }).click();
  await expect.poll(() => currentStock(props.request, id)).toBe(5);
  await props.page.screenshot({
    path: test.info().outputPath("stock-editor-desktop.png"),
    fullPage: true,
  });
  await props.page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      props.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
  await props.page.screenshot({
    path: test.info().outputPath("stock-editor-mobile.png"),
    fullPage: true,
  });
  await props.page.goto(`${E2E_SERVER_ORIGINS.web}/products/demo-store/${sku}`);
  await expect(
    props.page.getByRole("button", { name: "カートに入れる", exact: true }),
  ).toBeEnabled();
});

test("在庫変更は古い値・不正数量・他企業・一般ユーザーを拒否する", async (props) => {
  const create = await props.request.post("/api/trpc/product.create", {
    data: {
      sku: `GUARD-${crypto.randomUUID()}`,
      name: "在庫権限",
      unitPrice: 100,
      initialStock: 3,
    },
  });
  expect(create.status()).toBe(200);
  const { id } = (await create.json()).result.data;
  const data = { id, quantity: 5, expectedStock: 3 };
  expect((await props.request.post("/api/trpc/inventory.change", { data })).status()).toBe(200);
  expect(
    (
      await props.request.post("/api/trpc/inventory.change", {
        headers: { "x-demo-user": "demo-member" },
        data,
      })
    ).status(),
  ).toBe(403);
  const stale = await props.request.post("/api/trpc/inventory.change", { data });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.data.errorCode).toBe("STOCK_CHANGED");
  expect(
    (
      await props.request.post("/api/trpc/inventory.change", { data: { ...data, quantity: -1 } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await props.request.post("/api/trpc/inventory.change", {
        headers: { "x-organization-id": "demo-second" },
        data,
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await props.request.post("/api/trpc/inventory.change", {
        headers: { "x-demo-user": "demo-customer" },
        data,
      })
    ).status(),
  ).toBe(403);
});

test("購入の予約中は予約数を下回る在庫に変更できない", async (props) => {
  const sku = `RESERVED-${crypto.randomUUID()}`;
  const create = await props.request.post("/api/trpc/product.create", {
    data: { sku, name: "予約中の商品", unitPrice: 100, initialStock: 3 },
  });
  expect(create.status()).toBe(200);
  const { id } = (await create.json()).result.data;
  const checkout = await props.request.post("/api/trpc/store.checkout", {
    headers: { "x-demo-user": "demo-customer" },
    data: {
      tenantId: "demo-store",
      lines: [{ sku, name: "予約中の商品", unitPrice: 100, quantity: 2 }],
    },
  });
  expect(checkout.status()).toBe(200);
  const current = await props.request.get(
    `/api/trpc/inventory.get?input=${encodeURIComponent(JSON.stringify({ id }))}`,
  );
  expect((await current.json()).result.data).toEqual({ onHand: 3, reserved: 2, available: 1 });
  const change = await props.request.post("/api/trpc/inventory.change", {
    data: { id, quantity: 1, expectedStock: 3 },
  });
  expect(change.status()).toBe(409);
  expect((await change.json()).error.data.errorCode).toBe("STOCK_RESERVED");
});

test("0個の商品も登録でき、在庫変更で購入可能になる", async (props) => {
  const sku = `ZERO-${crypto.randomUUID()}`;
  const created = await props.request.post("/api/trpc/product.create", {
    data: { sku, name: "初期在庫ゼロ", unitPrice: 100, initialStock: 0 },
  });
  expect(created.status()).toBe(200);
  const { id } = (await created.json()).result.data;
  const input = encodeURIComponent(JSON.stringify({ tenantId: "demo-store", sku }));
  expect(
    (await (await props.request.get(`/api/trpc/store.get?input=${input}`)).json()).result.data
      .availableQuantity,
  ).toBe(0);
  expect(
    (
      await props.request.post("/api/trpc/inventory.change", {
        data: { id, quantity: 4, expectedStock: 0 },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await props.request.get(`/api/trpc/store.get?input=${input}`)).json()).result.data
      .availableQuantity,
  ).toBe(4);
});

async function registerStockProduct(page: Page) {
  const sku = `STOCK-${crypto.randomUUID()}`;
  const name = `在庫テスト-${crypto.randomUUID()}`;
  await page.goto("/organizations/demo-store/products/new");
  await page.getByLabel("SKU", { exact: true }).fill(sku);
  await page.getByLabel("商品名", { exact: true }).fill(name);
  await page.getByRole("button", { name: "商品を登録", exact: true }).click();
  await expect(
    page.getByText("在庫は0以上の整数を入力してください", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("初期在庫（個）").fill("3");
  await page.getByRole("button", { name: "商品を登録", exact: true }).click();
  await expect(page.getByLabel("入荷数（個）")).toBeVisible();
  await page.getByRole("button", { name: "棚卸し・訂正", exact: true }).click();
  await expect(page.getByLabel("棚卸し後の在庫数（個）")).toHaveValue("3");
  const id = page.url().split("/").at(-1)!;
  return { sku, id };
}

async function currentStock(request: APIRequestContext, id: string) {
  const response = await request.get(
    `/api/trpc/inventory.get?input=${encodeURIComponent(JSON.stringify({ id }))}`,
  );
  expect(response.status()).toBe(200);
  return (await response.json()).result.data.onHand as number;
}
