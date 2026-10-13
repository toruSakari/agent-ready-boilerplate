// @vitest-environment node
import { fileURLToPath } from "node:url";
import { createTestHarness } from "wrangler";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { MAX_IMAGE_BYTES } from "#api/application/product/policies/image-policy.ts";
import { TRPC_MAX_BODY_BYTES } from "#api/presentation/shared/middleware/limit-trpc-body.ts";

const server = createTestHarness({
  root: fileURLToPath(new URL("./", import.meta.url)),
  workers: [{ configPath: "./wrangler.image-transport-test.jsonc" }],
});
beforeAll(async () => {
  await server.listen();
}, 30000);
afterAll(async () => {
  await server.close();
});

function form(id: string, bytes: Uint8Array<ArrayBuffer>) {
  const body = new FormData();
  body.set("id", id);
  body.set("file", new File([bytes], "image.png", { type: "image/png" }));
  return body;
}

async function uploadImage(id: string, bytes: Uint8Array<ArrayBuffer>) {
  // Wrangler側とNode側のFormData実装が異なるため、送信側で標準のmultipartへ符号化する。
  const outgoing = new Request("http://fixture/api/trpc/product.addImage", {
    method: "POST",
    headers: { "x-test-role": "writer" },
    body: form(id, bytes),
  });
  return server.fetch("/api/trpc/product.addImage", {
    method: "POST",
    headers: Object.fromEntries(outgoing.headers),
    body: await outgoing.arrayBuffer(),
  });
}

it("workerdのHono・tRPC画像通信 / 5MiBのmultipartを解析し、取得のbase64がバイナリ全体を保持する", async () => {
  const bytes = Uint8Array.from({ length: MAX_IMAGE_BYTES }, (_, index) => index % 256);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const upload = await uploadImage("roundtrip", bytes);
  expect(upload.status).toBe(200);
  expect(await upload.json()).toEqual({ result: { data: { ok: true } } });
  const query = new URLSearchParams({ input: JSON.stringify({ id: "roundtrip" }) });
  const response = await server.fetch(`/api/trpc/product.getImage?${query}`, {
    headers: { "x-test-role": "writer" },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    result: {
      data: {
        base64: Buffer.from(bytes).toString("base64"),
        contentType: "image/png",
        etag: "test-etag",
      },
    },
  });
});

it("workerdのHono・tRPC画像通信 / File.sizeが5MiBを1バイト超えるとパーサーの400ではなく413を返す", async () => {
  const response = await uploadImage("oversized-upload", new Uint8Array(MAX_IMAGE_BYTES + 1));
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({
    error: { data: { code: "PAYLOAD_TOO_LARGE", httpStatus: 413 } },
  });
});

it.each([undefined, "1"])(
  "workerdのHono・tRPC画像通信 / Content-Length=%sでも実multipartが6MiBを超えたら読取りを止め413を維持する",
  async (length) => {
    const query = new URLSearchParams({ role: "writer", ...(length ? { length } : {}) });
    const response = await server.fetch(`/probe?${query}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 413,
      body: { error: { data: { code: "PAYLOAD_TOO_LARGE", httpStatus: 413 } } },
      cancellations: 1,
      bytesPulled: TRPC_MAX_BODY_BYTES + 64 * 1024,
      stoppedBeforeEnd: true,
      sourceLocked: false,
      uploaded: false,
    });
  },
);

it("workerdのHono・tRPC画像通信 / 境界指定のないmultipartは400になる", async () => {
  const response = await server.fetch("/api/trpc/product.addImage", {
    method: "POST",
    headers: { "x-test-role": "writer", "content-type": "multipart/form-data" },
    body: "malformed multipart",
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { data: { code: "BAD_REQUEST" } } });
});

it.each([
  { role: "", status: 401, code: "UNAUTHORIZED" },
  { role: "reader", status: 403, code: "FORBIDDEN" },
])(
  "workerdのHono・tRPC画像通信 / fixture認可で拒否した$status要求は本文を読まず送信元を中断する",
  async (props) => {
    const response = await server.fetch(`/probe?${new URLSearchParams({ role: props.role })}`);
    expect(await response.json()).toMatchObject({
      status: props.status,
      body: { error: { data: { code: props.code } } },
      pulls: 0,
      cancellations: 1,
      bytesPulled: 0,
      sourceLocked: false,
      uploaded: false,
    });
  },
);

it("workerdのHono・tRPC画像通信 / 取得元が5MiBを1バイト超えたら画像や内部スタックを公開しない", async () => {
  const query = new URLSearchParams({
    input: JSON.stringify({ id: "oversized", oversized: true }),
  });
  const response = await server.fetch(`/api/trpc/product.getImage?${query}`, {
    headers: { "x-test-role": "writer" },
  });
  expect(response.status).toBe(500);
  const body = await response.json();
  expect(body).toMatchObject({
    error: { data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } },
  });
  expect(body).not.toHaveProperty("result");
  expect(body).not.toHaveProperty("error.data.stack");
});
