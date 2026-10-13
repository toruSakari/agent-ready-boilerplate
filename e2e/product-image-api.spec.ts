import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect, test } from "@/e2e/fixtures";
import { z } from "zod";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";
import { MAX_IMAGE_BYTES } from "#api/application/product/policies/image-policy.ts";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC",
  "base64",
);
const productSchema = z.object({
  id: z.string(),
  imageKey: z.string().nullable(),
  images: z.array(z.object({ id: z.string(), key: z.string(), createdAt: z.string() })),
});
const listResponseSchema = z.object({ result: z.object({ data: z.array(productSchema) }) });
const imageResponseSchema = z.object({
  result: z.object({
    data: z.object({
      base64: z.string(),
      contentType: z.literal("image/png"),
      etag: z.string().min(1),
    }),
  }),
});

async function expectImage(response: APIResponse) {
  expect(response.status()).toBe(200);
  const image = imageResponseSchema.parse(await response.json()).result.data;
  expect(Buffer.from(image.base64, "base64")).toEqual(png);
}

async function expectMutation(response: APIResponse) {
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ result: { data: { ok: true } } });
}

// page・browser fixtureに依存させず、Chromiumが起動できない環境でもD1/R2経路を検証する。
test("商品画像APIで複数追加・安全な差し替え・指定画像の冪等削除と認可を検証する", async (props) => {
  const initialState = { request: props.request };
  const flow0 = await createGalleryProduct(initialState);
  const flow1 = await createGalleryOperations(flow0);
  const flow2 = await verifyGalleryTenantIsolation(flow1);
  const flow3 = await verifyCustomerGalleryAccess(flow2);
  const flow4 = await rejectUnauthorizedImageMutations(flow3);
  const flow5 = await rejectInvalidImagePayloads(flow4);
  const flow6 = await replaceAndPromoteGalleryImages(flow5);
  await removeRemainingGalleryImages(flow6);
});

test("廃止した商品画像HTTP入口は直接APIと3画面で404を返す", async (props) => {
  const productId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  for (const origin of Object.values(E2E_SERVER_ORIGINS)) {
    for (const [method, path] of [
      ["GET", `/api/products/${productId}/image?service=business`],
      ["POST", `/api/products/${productId}/image`],
      ["DELETE", `/api/products/${productId}/image`],
      ["POST", `/api/products/${productId}/images`],
      ["GET", `/api/products/${productId}/images/${imageId}?service=business`],
      ["DELETE", `/api/products/${productId}/images/${imageId}`],
    ]) {
      const response = await props.request.fetch(`${origin}${path}`, { method });
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: "APIが見つかりません", code: "NOT_FOUND" });
    }
  }
});

async function createGalleryProduct(state: { request: APIRequestContext }) {
  const { request } = state;
  const created = await request.post("/api/trpc/product.create", {
    data: { sku: `API-${crypto.randomUUID()}`, name: "画像API検証商品", unitPrice: 100 },
  });
  expect(created.status()).toBe(200);
  const product = z
    .object({ result: z.object({ data: productSchema }) })
    .parse(await created.json()).result.data;
  expect(product.images).toEqual([]);
  expect(product.imageKey).toBeNull();
  const imageInput = {
    multipart: {
      id: product.id,
      file: { name: "product.png", mimeType: "image/png", buffer: png },
    },
  };
  function getImage(imageId?: string, headers?: Record<string, string>) {
    return request.get("/api/trpc/product.getImage", {
      headers,
      params: { input: JSON.stringify({ id: product.id, imageId, service: "business" }) },
    });
  }
  return { ...state, created, product, imageInput, getImage };
}

async function createGalleryOperations(state: Awaited<ReturnType<typeof createGalleryProduct>>) {
  const { request, product, imageInput } = state;
  function deleteImage(imageId?: string, headers?: Record<string, string>) {
    return request.post("/api/trpc/product.deleteImage", {
      headers,
      data: { id: product.id, imageId },
    });
  }
  async function snapshot() {
    const response = await request.get("/api/trpc/product.list", {
      params: { input: JSON.stringify({ service: "business" }) },
    });
    expect(response.status()).toBe(200);
    const current = listResponseSchema
      .parse(await response.json())
      .result.data.find((props) => props.id === product.id);
    if (!current) {
      throw new Error("作成した商品が一覧にありません");
    }

    return current;
  }
  await expectMutation(await request.post("/api/trpc/product.addImage", imageInput));
  const first = (await snapshot()).images[0]!;
  await expectMutation(await request.post("/api/trpc/product.addImage", imageInput));
  await expectMutation(await request.post("/api/trpc/product.addImage", imageInput));
  const gallery = await snapshot();
  return { ...state, deleteImage, snapshot, first, gallery };
}

async function verifyGalleryTenantIsolation(
  state: Awaited<ReturnType<typeof createGalleryOperations>>,
) {
  const { getImage, first, gallery } = state;
  expect(gallery.images).toHaveLength(3);
  expect(new Set(gallery.images.map((props) => props.id)).size).toBe(3);
  expect(new Set(gallery.images.map((props) => props.key)).size).toBe(3);
  expect(gallery.imageKey).toBe(first.key);
  for (const image of gallery.images) {
    await expectImage(await getImage(image.id));
  }

  await expectImage(await getImage());
  return { ...state };
}

async function verifyCustomerGalleryAccess(
  state: Awaited<ReturnType<typeof verifyGalleryTenantIsolation>>,
) {
  const { request, product, first } = state;
  for (const origin of Object.values(E2E_SERVER_ORIGINS)) {
    const customerHeaders = { "x-demo-user": "demo-customer", "x-organization-id": "demo-store" };
    const customerImage = await request.get(`${origin}/api/trpc/product.getImage`, {
      headers: customerHeaders,
      params: { input: JSON.stringify({ id: product.id, imageId: first.id, service: "customer" }) },
    });
    await expectImage(customerImage);
    const forgedService = await request.get(`${origin}/api/trpc/product.getImage`, {
      headers: customerHeaders,
      params: { input: JSON.stringify({ id: product.id, imageId: first.id, service: "business" }) },
    });
    expect(forgedService.status()).toBe(403);
    const deniedMutation = await request.post(`${origin}/api/trpc/product.deleteImage`, {
      headers: customerHeaders,
      data: { id: product.id, imageId: first.id },
    });
    expect(deniedMutation.status()).toBe(403);
    const missingService = await request.get(`${origin}/api/trpc/product.getImage`, {
      params: { input: JSON.stringify({ id: product.id, imageId: first.id }) },
    });
    expect(missingService.status()).toBe(400);
  }

  return { ...state };
}

async function rejectUnauthorizedImageMutations(
  state: Awaited<ReturnType<typeof verifyCustomerGalleryAccess>>,
) {
  const { getImage, deleteImage, snapshot, first, gallery } = state;
  expect(await snapshot()).toEqual(gallery);
  const otherTenant = { "x-organization-id": "demo-second" };
  const member = { "x-demo-role": "member" };
  const unregistered = { "x-demo-user": `unregistered-image-${crypto.randomUUID()}` };
  expect((await getImage(first.id, otherTenant)).status()).toBe(404);
  expect((await deleteImage(first.id, otherTenant)).status()).toBe(404);
  expect((await deleteImage(first.id, member)).status()).toBe(403);
  expect((await getImage(first.id, unregistered)).status()).toBe(403);
  expect((await deleteImage(first.id, unregistered)).status()).toBe(403);
  return { ...state, otherTenant, member, unregistered };
}

async function rejectInvalidImagePayloads(
  state: Awaited<ReturnType<typeof rejectUnauthorizedImageMutations>>,
) {
  const { request, product, imageInput, otherTenant, member, unregistered } = state;
  for (const procedure of ["addImage", "replaceImage"]) {
    const endpoint = `/api/trpc/product.${procedure}`;
    expect((await request.post(endpoint, { ...imageInput, headers: otherTenant })).status()).toBe(
      404,
    );
    expect((await request.post(endpoint, { ...imageInput, headers: member })).status()).toBe(403);
    expect((await request.post(endpoint, { ...imageInput, headers: unregistered })).status()).toBe(
      403,
    );
    for (const [file, status] of [
      [{ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("invalid image") }, 400],
      [{ name: "invalid.gif", mimeType: "image/gif", buffer: png }, 400],
      [{ name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) }, 400],
      [
        { name: "oversized.png", mimeType: "image/png", buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1) },
        413,
      ],
    ] as const) {
      const response = await request.post(endpoint, { multipart: { id: product.id, file } });
      expect(response.status()).toBe(status);
    }
  }

  return { ...state };
}

async function replaceAndPromoteGalleryImages(
  state: Awaited<ReturnType<typeof rejectInvalidImagePayloads>>,
) {
  const { request, imageInput, getImage, deleteImage, snapshot, first, gallery } = state;
  expect(await snapshot()).toEqual(gallery);
  await expectMutation(await request.post("/api/trpc/product.replaceImage", imageInput));
  const replaced = await snapshot();
  expect(replaced.images).toHaveLength(3);
  expect(replaced.imageKey).not.toBe(first.key);
  expect(replaced.images).not.toContainEqual(first);
  const additional = gallery.images.filter((props) => props.id !== first.id);
  for (const image of additional) {
    expect(replaced.images).toContainEqual(image);
  }

  expect((await getImage(first.id)).status()).toBe(404);
  const replacement = replaced.images.find((props) => props.key === replaced.imageKey)!;
  await expectImage(await getImage(replacement.id));
  await expectMutation(await deleteImage(replacement.id));
  const promoted = await snapshot();
  expect(promoted.images).toEqual(additional);
  expect(promoted.imageKey).toBe(additional[0]!.key);
  await expectMutation(await deleteImage(replacement.id));
  expect(await snapshot()).toEqual(promoted);
  await expectImage(await getImage());
  await expectMutation(await deleteImage(additional[1]!.id));
  const remaining = await snapshot();
  expect(remaining.images).toEqual([additional[0]]);
  expect(remaining.imageKey).toBe(additional[0]!.key);
  return { ...state, replaced, additional, replacement, promoted, remaining };
}

async function removeRemainingGalleryImages(
  state: Awaited<ReturnType<typeof replaceAndPromoteGalleryImages>>,
) {
  const { getImage, deleteImage, snapshot, additional } = state;
  await expectMutation(await deleteImage(additional[1]!.id));
  expect(await snapshot()).toEqual(state.remaining);
  await expectMutation(await deleteImage());
  const empty = await snapshot();
  expect(empty.images).toEqual([]);
  expect(empty.imageKey).toBeNull();
  expect((await getImage()).status()).toBe(404);
  await expectMutation(await deleteImage(additional[0]!.id));
  expect(await snapshot()).toEqual(empty);
  return { ...state, empty };
}
