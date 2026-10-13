import { test, expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

// プロキシや自己申告ロールを変えても、企業の代理注文作成を復活させない。
test("企業はどのAPI入口からも注文を作成できない", async (props) => {
  for (const origin of Object.values(E2E_SERVER_ORIGINS)) {
    const response = await props.request.post(`${origin}/api/trpc/order.create`, {
      headers: {
        "x-demo-user": "demo-user",
        "x-demo-role": "admin",
        "x-organization-id": "demo-store",
      },
      data: {
        service: "business",
        draft: true,
        lines: [{ sku: "SKU-EDGE-MUG", name: "代理注文", quantity: 1, unitPrice: 2400 }],
      },
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ error: { data: { code: "FORBIDDEN" } } });
  }
});

test("企業の注文管理は受注一覧を表示し、作成ボタンと旧作成ページを提供しない", async (props) => {
  await props.page.goto("/organizations/demo-store/orders");
  await expect(props.page.getByRole("heading", { name: "注文管理", exact: true })).toBeVisible();
  await expect(props.page.getByRole("link", { name: "注文を作成", exact: true })).toHaveCount(0);
  await expect(props.page.getByRole("button", { name: "注文する", exact: true })).toHaveCount(0);
  const removed = await props.page.goto("/organizations/demo-store/orders/new");
  expect(removed?.status()).toBe(404);
  await expect(props.page.getByLabel("SKU", { exact: true })).toHaveCount(0);
});
