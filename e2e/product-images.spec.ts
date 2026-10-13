import type { Page, APIRequestContext } from "@playwright/test";
import { expect, test } from "@/e2e/fixtures";
import { MAX_IMAGE_BYTES } from "#api/application/product/policies/image-policy.ts";

test.beforeEach(async (props) => {
  props.page.on("pageerror", (error) => console.error("ブラウザーの実行エラー:", error.message));
  props.page.on("console", (message) => {
    if (message.type() === "error") {
      console.error("ブラウザーのコンソールエラー:", message.text());
    }
  });
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC",
  "base64",
);

test("D1とR2を通して商品画像の追加・表示・削除を行う", async (props) => {
  const initialState = { page: props.page, request: props.request };
  const flow0 = await createProductAndValidateImage(initialState);
  const flow1 = await verifyStoredImageAndReadProduct(flow0);
  const flow2 = await prepareImageAuthorizationRequests(flow1);
  const flow3 = await rejectUnauthorizedImageChanges(flow2);
  const flow4 = await validateImageSizeAndAppendGallery(flow3);
  const flow5 = await verifyAdditionalImageAuthorization(flow4);
  await replaceAndDeleteProductImages(flow5);
});

test("商品フォームの不正入力を送信前に拒否する", async (props) => {
  await props.page.goto("/organizations/demo-store/products/new");
  let creates = 0;
  props.page.on("request", (request) => {
    if (request.url().includes("/api/trpc/product.create")) {
      creates++;
    }
  });
  await props.page.getByLabel("SKU", { exact: true }).fill("   ");
  await props.page.getByLabel("商品名", { exact: true }).fill("入力検証商品");
  await props.page.getByLabel("価格（円）", { exact: true }).fill("");
  await props.page.getByRole("button", { name: "商品を登録", exact: true }).click();
  await expect(
    props.page.getByRole("alert").filter({ hasText: "SKUを入力してください" }),
  ).toBeVisible();
  await expect(
    props.page
      .getByRole("alert")
      .filter({ hasText: "価格は0以上10000000以下の整数にしてください" }),
  ).toBeVisible();
  expect(creates).toBe(0);
});

test("画像追加の中断後に保存済み画像を確認して残りだけ再選択できる", async (props) => {
  const initialState = { page: props.page };
  const flow0 = await createInterruptedUploadFixture(initialState);
  const flow1 = await recoverInterruptedUploadAndNavigate(flow0);
  await verifyUploadStateAfterHistoryNavigation(flow1);
});

async function createProductAndValidateImage(state: { page: Page; request: APIRequestContext }) {
  const { page } = state;
  const name = `画像テスト商品-${crypto.randomUUID()}`;
  await page.goto("/organizations/demo-store/products/new");
  await page.getByLabel("SKU", { exact: true }).fill(`TEST-${crypto.randomUUID()}`);
  await page.getByLabel("商品名", { exact: true }).fill(name);
  await page.getByLabel("初期在庫（個）", { exact: true }).fill("3");
  await page.getByRole("button", { name: "商品を登録", exact: true }).click();
  const card = page.getByRole("heading", { name: "商品画像", exact: true }).locator("..");
  const input = card.getByLabel(`${name}の画像`, { exact: true });
  await input.setInputFiles({
    name: "invalid.gif",
    mimeType: "image/gif",
    buffer: png,
  });
  await expect(card.getByRole("alert")).toHaveText("5MB以下のPNG・JPEG・WebP画像を選んでください");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.setInputFiles({
    name: "product.png",
    mimeType: "image/png",
    buffer: png,
  });
  return { ...state, name, card, input };
}

async function verifyStoredImageAndReadProduct(
  state: Awaited<ReturnType<typeof createProductAndValidateImage>>,
) {
  const { page, request, name, card } = state;
  const image = card.getByRole("img", {
    name: `${name}の商品画像`,
    exact: true,
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBe(1);
  await page.reload();
  await expect(image).toBeVisible();
  const idResponse = await request.get("/api/trpc/product.list", {
    params: { input: JSON.stringify({ service: "business" }) },
  });
  const data = await idResponse.json();
  const product = data.result.data.find((item: { name: string }) => item.name === name);
  return { ...state, image, idResponse, data, product };
}

async function prepareImageAuthorizationRequests(
  state: Awaited<ReturnType<typeof verifyStoredImageAndReadProduct>>,
) {
  const { request, product } = state;
  function getImage(imageId?: string, headers?: Record<string, string>) {
    return request.get("/api/trpc/product.getImage", {
      headers,
      params: {
        input: JSON.stringify({ id: product.id, imageId, service: "business" }),
      },
    });
  }
  const imageInput = {
    multipart: {
      id: product.id,
      file: { name: "product.png", mimeType: "image/png", buffer: png },
    },
  };
  expect((await getImage(undefined, { "x-organization-id": "demo-second" })).status()).toBe(404);
  return { ...state, getImage, imageInput };
}

async function rejectUnauthorizedImageChanges(
  state: Awaited<ReturnType<typeof prepareImageAuthorizationRequests>>,
) {
  const { request, product, imageInput } = state;
  expect(
    (
      await request.post("/api/trpc/product.deleteImage", {
        headers: { "x-demo-role": "member" },
        data: { id: product.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/trpc/product.replaceImage", {
        multipart: {
          ...imageInput.multipart,
          file: {
            ...imageInput.multipart.file,
            buffer: Buffer.from("invalid"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  return { ...state };
}

async function validateImageSizeAndAppendGallery(
  state: Awaited<ReturnType<typeof rejectUnauthorizedImageChanges>>,
) {
  const { request, name, card, imageInput } = state;
  expect(
    (
      await request.post("/api/trpc/product.replaceImage", {
        multipart: {
          ...imageInput.multipart,
          file: {
            ...imageInput.multipart.file,
            buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1),
          },
        },
      })
    ).status(),
  ).toBe(413);
  const additionalInput = card.getByLabel(`${name}の画像を追加`, {
    exact: true,
  });
  await additionalInput.setInputFiles([
    { name: "second.png", mimeType: "image/png", buffer: png },
    { name: "third.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(card.getByRole("img")).toHaveCount(3);
  await expect(card.getByRole("status")).toHaveCount(0);
  return { ...state, additionalInput };
}

async function verifyAdditionalImageAuthorization(
  state: Awaited<ReturnType<typeof validateImageSizeAndAppendGallery>>,
) {
  const { page, request, name, card, product, getImage } = state;
  await page.reload();
  await expect(card.getByRole("img")).toHaveCount(3);
  const galleryResponse = await request.get("/api/trpc/product.list", {
    params: { input: JSON.stringify({ service: "business" }) },
  });
  const galleryProduct = (await galleryResponse.json()).result.data.find(
    (item: { name: string }) => item.name === name,
  );
  expect(galleryProduct.images).toHaveLength(3);
  const additionalImageId = galleryProduct.images[1].id;
  expect((await getImage(additionalImageId, { "x-organization-id": "demo-second" })).status()).toBe(
    404,
  );
  expect(
    (
      await request.post("/api/trpc/product.deleteImage", {
        headers: { "x-demo-role": "member" },
        data: { id: product.id, imageId: additionalImageId },
      })
    ).status(),
  ).toBe(403);
  return { ...state, galleryResponse, galleryProduct, additionalImageId };
}

async function replaceAndDeleteProductImages(
  state: Awaited<ReturnType<typeof verifyAdditionalImageAuthorization>>,
) {
  const { page, name, card, input, image, getImage, additionalImageId } = state;
  await input.setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(card.getByRole("status")).toHaveCount(0);
  await expect(image).toBeVisible();
  await expect(card.getByRole("img")).toHaveCount(3);
  await card.getByRole("button", { name: `${name}の画像2を削除`, exact: true }).click();
  await expect(card.getByRole("img")).toHaveCount(2);
  expect((await getImage(additionalImageId)).status()).toBe(404);
  await card.getByRole("button", { name: "画像を削除", exact: true }).click();
  await expect(card.getByRole("img")).toHaveCount(1);
  await expect(image).toBeVisible();
  await expect(card.getByRole("status")).toHaveCount(0);
  await card.getByRole("button", { name: "画像を削除", exact: true }).click();
  await expect(image).toHaveCount(0);
  expect((await getImage()).status()).toBe(404);
  await page.reload();
  await expect(card.getByText("画像未登録")).toBeVisible();
  return { ...state };
}

async function createInterruptedUploadFixture(state: { page: Page }) {
  const { page } = state;
  const name = `画像中断テスト-${crypto.randomUUID()}`;
  await page.goto("/organizations/demo-store/products/new");
  await page.getByLabel("SKU", { exact: true }).fill(`TEST-${crypto.randomUUID()}`);
  await page.getByLabel("商品名", { exact: true }).fill(name);
  await page.getByLabel("初期在庫（個）", { exact: true }).fill("3");
  await page.getByRole("button", { name: "商品を登録", exact: true }).click();
  const card = page.getByRole("heading", { name: "商品画像", exact: true }).locator("..");
  const additionalInput = card.getByLabel(`${name}の画像を追加`, {
    exact: true,
  });
  const attempts = { count: 0 };
  await page.route(
    (url) => url.pathname === "/api/trpc/product.addImage",
    async (route) => {
      if (route.request().method() === "POST" && ++attempts.count === 2) {
        await route.abort("connectionreset");
        return;
      }

      await route.continue();
    },
  );
  return { ...state, name, card, additionalInput, attempts };
}

async function recoverInterruptedUploadAndNavigate(
  state: Awaited<ReturnType<typeof createInterruptedUploadFixture>>,
) {
  const { page, card, additionalInput, attempts } = state;
  const files = [
    { name: "saved.png", mimeType: "image/png", buffer: png },
    { name: "interrupted.png", mimeType: "image/png", buffer: png },
  ];
  await additionalInput.setInputFiles(files);
  await expect(card.getByRole("alert")).toContainText("2枚中1枚の追加を確認しました");
  await expect(card.getByRole("img")).toHaveCount(1);
  await expect(additionalInput).toBeEnabled();
  await additionalInput.setInputFiles([]);
  expect(attempts.count).toBe(2);
  await additionalInput.setInputFiles([files[1]!]);
  await expect(card.getByRole("img")).toHaveCount(2);
  await expect(card.getByRole("status")).toHaveCount(0);
  await expect(card.getByRole("alert")).toHaveCount(0);
  expect(attempts.count).toBe(3);
  await page.getByRole("link", { name: "注文", exact: true }).click();
  await expect(page).toHaveURL(/\/organizations\/demo-store\/orders$/);
  await expect(page.getByRole("heading", { name: "注文管理", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/organizations\/demo-store\/products\/[^/]+$/);
  await expect(card.getByRole("img")).toHaveCount(2);
  await expect(card.getByRole("alert")).toHaveCount(0);
  return { ...state, files };
}

async function verifyUploadStateAfterHistoryNavigation(
  state: Awaited<ReturnType<typeof recoverInterruptedUploadAndNavigate>>,
) {
  const { page, card, additionalInput, attempts } = state;
  await expect(additionalInput).toHaveValue("");
  await page.goForward();
  await expect(page).toHaveURL(/\/organizations\/demo-store\/orders$/);
  await expect(page.getByRole("heading", { name: "注文管理", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/organizations\/demo-store\/products\/[^/]+$/);
  await expect(card.getByRole("img")).toHaveCount(2);
  await expect(card.getByRole("alert")).toHaveCount(0);
  await expect(additionalInput).toHaveValue("");
  expect(attempts.count).toBe(3);
  return { ...state };
}
