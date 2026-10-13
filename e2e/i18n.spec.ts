import { expect, test } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";
import { cookieName } from "@dev-template/client/i18n";

for (const [app, service] of [
  ["web", "Membership and closure"],
  ["business", "Business service registration and withdrawal"],
  ["admin", "Operator service registration and withdrawal"],
] as const) {
  test(`${app}はCookieの言語でSSRし、切替と再読込み後も一致する`, async (props) => {
    const origin = E2E_SERVER_ORIGINS[app];
    await props.context.addCookies([{ name: cookieName, value: "en", url: origin }]);
    const html = await props.context.request.get(`${origin}/account`);
    expect(html.ok()).toBe(true);
    expect(html.headers()["cache-control"]).toBe("private, no-store");
    const body = await html.text();
    expect(body).toContain('lang="en"');
    // 認証後のデータ領域はクライアントで描画する。SSRシェルの翻訳を確認する。
    expect(body).toContain("Choose display language");
    expect(body).not.toContain("表示言語を選択");
    const hydrationErrors: string[] = [];
    props.page.on("console", (message) => {
      if (/hydration|did not match/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    await props.page.goto(`${origin}/account`);
    await expect(
      props.page.getByRole("heading", {
        name: service,
      }),
    ).toBeVisible();
    await props.page.getByRole("combobox", { name: "Choose display language" }).selectOption("ja");
    await expect(props.page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(props.page.getByRole("combobox", { name: "表示言語を選択" })).toHaveValue("ja");
    await props.page.reload();
    await expect(props.page.locator("html")).toHaveAttribute("lang", "ja");
    expect(hydrationErrors).toEqual([]);
  });
}

test("英語の入力検証とAPIエラー表示でも入力を保持し、内部本文を公開しない", async (props) => {
  await props.context.addCookies([
    { name: cookieName, value: "en", url: E2E_SERVER_ORIGINS.business },
  ]);
  await props.page.route("**/api/trpc/product.create*", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          message: "private_database_detail",
          code: -32003,
          data: { code: "FORBIDDEN", errorCode: "FORBIDDEN", httpStatus: 403 },
        },
      },
    }),
  );
  await props.page.goto("/organizations/demo-store/products/new");
  await props.page.getByRole("button", { name: "Register product", exact: true }).click();
  await expect(props.page.getByText("Enter an SKU", { exact: true })).toBeVisible();
  await props.page.getByLabel("SKU", { exact: true }).fill("I18N-INPUT");
  await props.page.getByLabel("Product name", { exact: true }).fill("Localized product");
  await props.page.getByLabel("Initial stock (units)", { exact: true }).fill("3");
  await props.page.getByRole("button", { name: "Register product", exact: true }).click();
  await expect(props.page.getByRole("alert")).toContainText(
    "You do not have permission to perform this action",
  );
  await expect(props.page.getByLabel("SKU", { exact: true })).toHaveValue("I18N-INPUT");
  await expect(props.page.getByText("private_database_detail")).toHaveCount(0);
});

test("未対応の言語Cookieはサーバーもブラウザーも日本語へ戻る", async (props) => {
  await props.context.addCookies([
    { name: cookieName, value: "unknown", url: E2E_SERVER_ORIGINS.business },
  ]);
  await props.page.goto("/account");
  await expect(props.page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(
    props.page.getByRole("heading", { name: "事業者サービスの登録情報・退会" }),
  ).toBeVisible();
});
