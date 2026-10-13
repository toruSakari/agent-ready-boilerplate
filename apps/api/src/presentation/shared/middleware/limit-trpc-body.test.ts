// @vitest-environment node
import { expect, it, vi } from "vite-plus/test";
import {
  limitTrpcBody,
  TRPC_MAX_BODY_BYTES,
} from "#api/presentation/shared/middleware/limit-trpc-body.ts";

function request(body: ReadableStream<Uint8Array>, length?: string) {
  return new Request("http://localhost/api/trpc/product.addImage", {
    method: "POST",
    headers: length ? { "content-length": length } : {},
    body,
    duplex: "half",
  } as RequestInit);
}

function fixture(chunks: Uint8Array[], cancel = vi.fn()) {
  const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) => {
    const chunk = chunks.shift();
    if (chunk) {
      controller.enqueue(chunk);
    } else {
      controller.close();
    }
  });
  return {
    source: new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 }),
    pull,
    cancel,
  };
}

it("tRPC本文の遅延実測上限 / 構築時は読取りもロックもせず、未消費の中断を元の本文へ渡す", async () => {
  const { source, pull, cancel } = fixture([new Uint8Array([1])]);
  const bounded = limitTrpcBody(request(source));
  await Promise.resolve();
  expect(pull).not.toHaveBeenCalled();
  expect(source.locked).toBe(false);
  await bounded.body!.cancel("unused");
  expect(cancel).toHaveBeenCalledExactlyOnceWith("unused");
  expect(pull).not.toHaveBeenCalled();
});

it.each([undefined, "1", String(TRPC_MAX_BODY_BYTES * 2)])(
  "tRPC本文の遅延実測上限 / 長さ申告%sによらず上限ちょうどの実体を受け入れる",
  async (length) => {
    const { source } = fixture([new Uint8Array(TRPC_MAX_BODY_BYTES - 1), new Uint8Array([7])]);
    const bytes = new Uint8Array(await limitTrpcBody(request(source, length)).arrayBuffer());
    expect(bytes.byteLength).toBe(TRPC_MAX_BODY_BYTES);
    expect(bytes.at(-1)).toBe(7);
    expect(source.locked).toBe(false);
  },
);

it.each([undefined, "1"])(
  "tRPC本文の遅延実測上限 / 長さ申告%sの実超過を中断し、次のチャンクを消費しない",
  async (length) => {
    const chunks = [new Uint8Array(TRPC_MAX_BODY_BYTES), new Uint8Array([1]), new Uint8Array([2])];
    const { source, pull, cancel } = fixture(chunks);
    await expect(limitTrpcBody(request(source, length)).arrayBuffer()).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(pull).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toHaveLength(1);
    expect(source.locked).toBe(false);
  },
);

it("tRPC本文の遅延実測上限 / 1チャンクだけで超過しても413を返し、中断失敗で上書きしない", async () => {
  const cancel = vi.fn().mockRejectedValue(new Error("private cancellation failure"));
  const { source } = fixture([new Uint8Array(TRPC_MAX_BODY_BYTES + 1)], cancel);
  await expect(limitTrpcBody(request(source)).arrayBuffer()).rejects.toMatchObject({
    code: "PAYLOAD_TOO_LARGE",
  });
  expect(source.locked).toBe(false);
});

it("tRPC本文の遅延実測上限 / 下流の途中中断を元へ渡してロックを解放する", async () => {
  const { source, pull, cancel } = fixture([new Uint8Array([1]), new Uint8Array([2])]);
  const reader = limitTrpcBody(request(source)).body!.getReader();
  await reader.read();
  await reader.cancel("stop");
  reader.releaseLock();
  expect(pull).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledExactlyOnceWith("stop");
  expect(source.locked).toBe(false);
});

it("tRPC本文の遅延実測上限 / 読み取り失敗でもロックを解放する", async () => {
  const error = new Error("disconnected");
  const source = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        controller.error(error);
      },
    },
    { highWaterMark: 0 },
  );
  await expect(limitTrpcBody(request(source)).arrayBuffer()).rejects.toBe(error);
  expect(source.locked).toBe(false);
});
