import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "@/e2e/fixtures";

const WCAG_AA_MIN_TEXT_CONTRAST = 4.5;

for (const theme of ["light", "dark"] as const) {
  test(`${theme}モードでフォーム・エラー・メニューを読みやすく表示する`, async (props, testInfo) => {
    const initialState = { page: props.page, testInfo, theme };
    const flow0 = await prepareThemeContrastFixture(initialState);
    const flow1 = await verifyThemeMenuSurface(flow0);
    const flow2 = await measureRenderedTextContrast(flow1);
    await verifyContrastAndCaptureTheme(flow2);
  });
}

test("手動テーマを移動・再読み込み後も保持し、システム設定へ戻せる", async (props) => {
  await props.page.emulateMedia({ colorScheme: "light" });
  await Promise.all([
    props.page.waitForResponse(
      (response) =>
        response.url().includes("/api/trpc/") && response.url().includes("product.list"),
    ),
    props.page.goto("/organizations/demo-store/products"),
  ]);
  await props.page.getByRole("button", { name: "テーマを選択" }).focus();
  await props.page.keyboard.press("Enter");
  await props.page.getByRole("menuitemradio", { name: "ダーク", exact: true }).focus();
  await props.page.keyboard.press("Enter");
  await expect(props.page.locator("html")).toHaveClass("dark");
  await Promise.all([
    props.page.waitForResponse((response) => response.url().includes("/api/trpc/order.list")),
    props.page.getByRole("link", { name: "注文" }).click(),
  ]);
  await expect(props.page.locator("html")).toHaveClass("dark");
  await props.page.reload();
  await expect(props.page.locator("html")).toHaveClass("dark");
  await props.page.getByRole("button", { name: "テーマを選択" }).click();
  await expect(
    props.page.getByRole("menuitemradio", { name: "ダーク", exact: true }),
  ).toBeChecked();
  await props.page.getByRole("menuitemradio", { name: "システム設定に合わせる" }).click();
  await expect(props.page.locator("html")).toHaveClass("light");
  await props.page.emulateMedia({ colorScheme: "dark" });
  await expect(props.page.locator("html")).toHaveClass("dark");
  await props.page.emulateMedia({ colorScheme: "light" });
  await expect(props.page.locator("html")).toHaveClass("light");
});

async function prepareThemeContrastFixture(state: {
  page: Page;
  testInfo: TestInfo;
  theme: "light" | "dark";
}) {
  const { page, theme } = state;
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto("/organizations/demo-store/products/new");
  await expect(page.locator("html")).toHaveClass(theme);
  await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
  const card = page.getByRole("heading", { name: "商品を登録" }).locator("..");
  const surface = theme === "dark" ? "rgb(15, 23, 42)" : "rgb(255, 255, 255)";
  await expect(card).toHaveCSS("background-color", surface);
  await expect(page.getByLabel("SKU", { exact: true })).toHaveCSS(
    "background-color",
    theme === "dark" ? "rgb(2, 6, 23)" : "rgb(243, 244, 246)",
  );
  await page.getByLabel("SKU", { exact: true }).fill(" ");
  await page.getByLabel("商品名", { exact: true }).fill("テーマ検証商品");
  await page.getByRole("button", { name: "商品を登録", exact: true }).click();
  const error = page.getByRole("alert").filter({ hasText: "SKUを入力してください" });
  await expect(error).toBeVisible();
  await page.getByRole("button", { name: "テーマを選択" }).click();
  return { ...state, browserErrors, card, surface, error };
}

async function verifyThemeMenuSurface(
  state: Awaited<ReturnType<typeof prepareThemeContrastFixture>>,
) {
  const { page, surface } = state;
  await expect(page.getByRole("menu")).toHaveCSS("background-color", surface);
  await expect(page.getByRole("menuitemradio", { name: "システム設定に合わせる" })).toBeChecked();
  await page.keyboard.press("Escape");
  return { ...state };
}

async function measureRenderedTextContrast(
  state: Awaited<ReturnType<typeof verifyThemeMenuSurface>>,
) {
  const { card } = state;
  const contrast = await card.evaluate((element) => {
    // sRGBの伝達関数で線形化し、WCAGの相対輝度係数で文字と背景を比較する。
    const SRGB = Object.freeze({
      channelMax: 255,
      linearThreshold: 0.04045,
      linearScale: 12.92,
      gammaOffset: 0.055,
      gammaScale: 1.055,
      gamma: 2.4,
    });
    const LUMINANCE_WEIGHTS = Object.freeze({
      red: 0.2126,
      green: 0.7152,
      blue: 0.0722,
    });
    const WCAG_LUMINANCE_OFFSET = 0.05;
    const RGB_CHANNEL_COUNT = 3;
    function luminance(color: string) {
      const channels = (color.match(/[\d.]+/g) ?? [])
        .slice(0, RGB_CHANNEL_COUNT)
        .map(Number)
        .map((n) => {
          const value = n / SRGB.channelMax;
          return value <= SRGB.linearThreshold
            ? value / SRGB.linearScale
            : ((value + SRGB.gammaOffset) / SRGB.gammaScale) ** SRGB.gamma;
        });
      return (
        channels[0] * LUMINANCE_WEIGHTS.red +
        channels[1] * LUMINANCE_WEIGHTS.green +
        channels[2] * LUMINANCE_WEIGHTS.blue
      );
    }
    const background = getComputedStyle(element).backgroundColor;
    return [...element.querySelectorAll("label, [role=alert], button[type=submit]")].map((item) => {
      const style = getComputedStyle(item);
      const bg = style.backgroundColor === "rgba(0, 0, 0, 0)" ? background : style.backgroundColor;
      const a = luminance(style.color);
      const b = luminance(bg);
      return (Math.max(a, b) + WCAG_LUMINANCE_OFFSET) / (Math.min(a, b) + WCAG_LUMINANCE_OFFSET);
    });
  });
  return { ...state, contrast };
}

async function verifyContrastAndCaptureTheme(
  state: Awaited<ReturnType<typeof measureRenderedTextContrast>>,
) {
  const { page, testInfo, theme, browserErrors, contrast } = state;
  expect(contrast.length).toBeGreaterThan(0);
  for (const ratio of contrast) {
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_MIN_TEXT_CONTRAST);
  }

  expect(browserErrors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath(`theme-${theme}.png`),
    fullPage: true,
  });
  return { ...state };
}
