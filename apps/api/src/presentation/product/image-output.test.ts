// @vitest-environment node
import { expect, it, vi } from "vite-plus/test";
import { imageOutput } from "#api/presentation/product/image-output.ts";
import { MAX_IMAGE_BYTES } from "#api/application/product/policies/image-policy.ts";

function image(chunks: Uint8Array[], contentType = "image/png") {
  const cancel = vi.fn();
  const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) => {
    const chunk = chunks.shift();
    if (chunk) {
      controller.enqueue(chunk);
    } else {
      controller.close();
    }
  });
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
  return { stored: { body, contentType, etag: "e1" }, pull, cancel };
}

it.each(["image/png", "image/jpeg", "image/webp"])(
  "商品画像の有界JSON応答 / %sのチャンク境界を越えて正確にbase64化する",
  async (contentType) => {
    const { stored } = image([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])], contentType);
    expect(await imageOutput(stored, new AbortController().signal)).toEqual({
      base64: "AQIDBAU=",
      contentType,
      etag: "e1",
    });
    expect(stored.body.locked).toBe(false);
  },
);

it("商品画像の有界JSON応答 / 5MiBちょうどを受け入れ、末尾とbase64の4/3増加を確認する", async () => {
  const first = new Uint8Array(MAX_IMAGE_BYTES - 1);
  first[0] = 9;
  const { stored } = image([first, new Uint8Array([7])]);
  const result = await imageOutput(stored, new AbortController().signal);
  expect(result.base64.length).toBe(4 * Math.ceil(MAX_IMAGE_BYTES / 3));
  const bytes = Buffer.from(result.base64, "base64");
  expect(bytes.length).toBe(MAX_IMAGE_BYTES);
  expect(bytes[0]).toBe(9);
  expect(bytes.at(-1)).toBe(7);
});

it("商品画像の有界JSON応答 / 保存済み実体の5MiB超過を公開前に中断する", async () => {
  const { stored, pull, cancel } = image([
    new Uint8Array(MAX_IMAGE_BYTES),
    new Uint8Array([1]),
    new Uint8Array([2]),
  ]);
  await expect(imageOutput(stored, new AbortController().signal)).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
  expect(pull).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledOnce();
  expect(stored.body.locked).toBe(false);
});

it("商品画像の有界JSON応答 / 保存済みの不正なMIMEは本文を読まず中断する", async () => {
  const { stored, pull, cancel } = image([new Uint8Array([1])], "image/svg+xml");
  await expect(imageOutput(stored, new AbortController().signal)).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
  expect(pull).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  expect(stored.body.locked).toBe(false);
});

it("商品画像の有界JSON応答 / 既に中断された取得を読まずに終了する", async () => {
  const { stored, pull, cancel } = image([new Uint8Array([1])]);
  const abort = new AbortController();
  abort.abort(new Error("stop"));
  await expect(imageOutput(stored, abort.signal)).rejects.toThrow("stop");
  expect(pull).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  expect(stored.body.locked).toBe(false);
});

it("商品画像の有界JSON応答 / 読取り待ち中の中断でも保存ストリームを閉じてロックを解放する", async () => {
  const pull = vi.fn();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
  const abort = new AbortController();
  const result = imageOutput({ body, contentType: "image/png", etag: "e1" }, abort.signal);
  const rejected = expect(result).rejects.toThrow("stop");
  await Promise.resolve();
  abort.abort(new Error("stop"));
  await rejected;
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});

it("商品画像の有界JSON応答 / 保存ストリームの失敗でもロックを解放する", async () => {
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        controller.error(new Error("storage failure"));
      },
    },
    { highWaterMark: 0 },
  );
  await expect(
    imageOutput({ body, contentType: "image/png", etag: "e1" }, new AbortController().signal),
  ).rejects.toThrow("storage failure");
  expect(body.locked).toBe(false);
});
