import { createCustomerOrder } from "@/e2e/customer-order-fixture";
import { test, expect } from "@/e2e/fixtures";

for (const kind of ["商品", "注文"] as const) {
  test(`${kind}一覧の次へ・前へで続きを取得し、先頭への追加でも重複しない`, async (props) => {
    const prefix = `ページ-${crypto.randomUUID()}`;
    const names = Array.from({ length: 26 }, (_, index) => `${prefix}-${index}`);
    async function create(name: string) {
      const sku = `PAGE-${crypto.randomUUID()}`;
      if (kind === "商品") {
        const response = await props.request.post("/api/trpc/product.create", {
          data: { sku, name, unitPrice: 100 },
        });
        expect(response.status()).toBe(200);
      } else {
        await createCustomerOrder(props.request, [{ sku, name, quantity: 1, unitPrice: 100 }], {
          draft: true,
        });
      }
    }
    for (const name of names) {
      await create(name);
    }

    await props.page.goto(
      kind === "商品" ? "/organizations/demo-store/products" : "/organizations/demo-store/orders",
    );
    const item = (name: string) =>
      kind === "商品"
        ? props.page.getByRole("row").filter({ hasText: name })
        : props.page.getByRole("row").filter({ hasText: name });
    await expect(item(names.at(-1)!)).toBeVisible();
    const navigation = props.page.getByLabel(`${kind}のページ切替`);
    // 一覧を表示した後に先頭へ追加しても、表示済みページの末尾を基準に進む。
    await create(`${prefix}-new`);
    await navigation.getByRole("button", { name: "次へ", exact: true }).click();
    await expect(item(names[0]!)).toBeVisible();
    await expect(item(names.at(-1)!)).toHaveCount(0);
    await expect(navigation).toContainText("2ページ");
    await navigation.getByRole("button", { name: "前へ", exact: true }).click();
    await expect(item(names.at(-1)!)).toBeVisible();
    await expect(navigation).toContainText("1ページ");
  });
}
