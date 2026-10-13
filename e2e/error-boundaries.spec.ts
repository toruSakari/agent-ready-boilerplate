import type { Page } from "@playwright/test";
import { expect, test } from "@/e2e/fixtures";

test("商品の取得失敗をBoundaryで受け、再試行で回復して別画面へも移動できる", async (props) => {
  const initialState = { page: props.page };
  const flow0 = await createProductFailureControl(initialState);
  const flow1 = await interceptProductReadFailure(flow0);
  const flow2 = await recoverProductReadBoundary(flow1);
  await verifyOrderNavigationAfterRecovery(flow2);
});

test("不正な企業パスをBoundaryで拒否し、商品管理を表示しない", async (props) => {
  await props.page.goto("/organizations/tenant%0Ainvalid/products");
  await expect(
    props.page.getByRole("heading", { name: "画面を表示できませんでした" }),
  ).toBeVisible();
  await expect(props.page.getByRole("heading", { name: "商品管理" })).toHaveCount(0);
  await expect(props.page.getByRole("region", { name: "商品一覧" })).toHaveCount(0);
  await expect(props.page.getByText("ZodError")).toHaveCount(0);
});

async function createProductFailureControl(state: { page: Page }) {
  const failure = { enabled: true };
  const firstList = { pending: true };
  let releaseList!: () => void;
  const listResponse = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  return { ...state, failure, firstList, releaseList, listResponse };
}

async function interceptProductReadFailure(
  state: Awaited<ReturnType<typeof createProductFailureControl>>,
) {
  const { page, failure, firstList, listResponse } = state;
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const procedures = decodeURIComponent(url.pathname.split("/api/trpc/")[1] ?? "").split(",");
    const index = procedures.indexOf("product.list");
    if (!failure.enabled || request.method() !== "GET" || index < 0) {
      await route.continue();
      return;
    }

    if (firstList.pending) {
      firstList.pending = false;
      // 時間ではなく操作で読み込みを解除し、Skeleton表示中もナビゲーションが残ることを確認する。
      await listResponse;
    }

    // 同じバッチの資格確認を壊さず、対象領域の読み取り障害だけを再現する。
    const response = await route.fetch();
    const body = await response.json();
    const error = {
      error: {
        message: "private_database_detail",
        code: -32603,
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      },
    };
    if (Array.isArray(body)) {
      body[index] = error;
    }

    await route.fulfill({ response, json: Array.isArray(body) ? body : error });
  });
  return { ...state };
}

async function recoverProductReadBoundary(
  state: Awaited<ReturnType<typeof interceptProductReadFailure>>,
) {
  const { page, failure, releaseList } = state;
  await page.goto("/organizations/demo-store/products");
  const navigation = page.getByRole("link", { name: "注文", exact: true });
  try {
    await expect(page.getByRole("status", { name: "商品を読み込み中…" })).toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(page.getByRole("link", { name: "商品を登録", exact: true })).toBeVisible();
  } finally {
    releaseList();
  }

  await expect(page.getByRole("heading", { name: "画面を表示できませんでした" })).toBeVisible();
  await expect(navigation).toBeVisible();
  await expect(page.getByText("private_database_detail")).toHaveCount(0);
  failure.enabled = false;
  await page.getByRole("button", { name: "もう一度確認" }).click();
  await expect(page.getByRole("region", { name: "商品一覧" })).toBeVisible();
  await expect(navigation).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("/api/trpc/") && response.url().includes("order.list"),
    ),
    page.getByRole("link", { name: "注文", exact: true }).click(),
  ]);
  return { ...state, navigation };
}

async function verifyOrderNavigationAfterRecovery(
  state: Awaited<ReturnType<typeof recoverProductReadBoundary>>,
) {
  const { page } = state;
  await expect(page.getByRole("heading", { name: "注文管理" })).toBeVisible();
  return { ...state };
}
