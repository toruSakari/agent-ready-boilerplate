import { TRPCError } from "@trpc/server";
import { createMiddleware } from "hono/factory";

// Proxyからのストリームもここで実測する。画像本体の5MiBにmultipartの付帯情報を含めて制限する。
export const TRPC_MAX_BODY_BYTES = 6 * 1024 * 1024;

/** tRPCが入力を求めた時だけ読み、Content-Lengthに依存せず実測する。 */
export function limitTrpcBody(request: Request): Request {
  const source = request.body;
  if (!source) {
    return request;
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let size = 0;
  const release = () => {
    reader?.releaseLock();
    reader = undefined;
  };
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          reader ??= source.getReader();
          const result = await reader.read();
          if (result.done) {
            release();
            controller.close();
            return;
          }

          size += result.value.byteLength;
          if (size > TRPC_MAX_BODY_BYTES) {
            // 中断側の失敗で413を上書きせず、超過チャンクをパーサーへ渡さない。
            await reader.cancel().catch(() => {});
            release();
            controller.error(payloadTooLarge());
            return;
          }

          controller.enqueue(result.value);
        } catch (error) {
          release();
          controller.error(error);
        }
      },
      async cancel(reason) {
        try {
          await (reader ?? source).cancel(reason);
        } finally {
          release();
        }
      },
    },
    // 先読みをしない。固定サービスの認可に失敗したアップロードは本文を一度も読まない。
    { highWaterMark: 0 },
  );
  return new Request(request, { body, duplex: "half" } as RequestInit);
}

export const limitTrpcRequestBody = createMiddleware(async (context, next) => {
  // HonoのtRPCアダプターもcontext.req.formDataを呼ぶため、raw自体を置き換える。
  context.req.raw = limitTrpcBody(context.req.raw);
  try {
    await next();
  } finally {
    // 認可・入力形式で読む前に拒否した要求も、残りの送信を受け続けない。
    const body = context.req.raw.body;
    if (body && !body.locked) {
      await body.cancel().catch(() => {});
    }
  }
});

function payloadTooLarge() {
  return new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "送信データのサイズが大きすぎます" });
}
