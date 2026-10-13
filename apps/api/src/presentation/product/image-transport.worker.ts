import { trpcServer } from "@hono/trpc-server";
import { initTRPC, TRPCError } from "@trpc/server";
import { Hono } from "hono";
import { z } from "zod";
import { MAX_IMAGE_BYTES } from "#api/application/product/policies/image-policy.ts";
import { imageUploadInput, readImageFile } from "#api/presentation/product/image-input.ts";
import { imageOutput } from "#api/presentation/product/image-output.ts";
import { publicErrorMessage } from "#api/presentation/shared/errors.ts";
import {
  limitTrpcRequestBody,
  TRPC_MAX_BODY_BYTES,
} from "#api/presentation/shared/middleware/limit-trpc-body.ts";

// 通信境界だけをworkerdで検証するfixture。実認証・DB・R2・秘密情報には接続しない。
const images = new Map<string, { bytes: ArrayBuffer; contentType: string }>();
const t = initTRPC.context<{ request: Request }>().create({
  errorFormatter(props) {
    const { stack: _stack, ...data } = props.shape.data;
    return { ...props.shape, message: publicErrorMessage(props.error), data };
  },
});
const authorize = t.middleware((props) => {
  const role = props.ctx.request.headers.get("x-test-role");
  if (!role) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (role !== "writer") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return props.next();
});
const router = t.router({
  product: t.router({
    addImage: t.procedure
      .use(authorize)
      .input(imageUploadInput)
      .mutation(async (props) => {
        images.set(props.input.id, await readImageFile(props.input.file));
        return { ok: true };
      }),
    getImage: t.procedure
      .use(authorize)
      .input(z.object({ id: z.string(), oversized: z.boolean().optional() }))
      .query(async (props) => {
        const image = props.input.oversized
          ? { bytes: new ArrayBuffer(MAX_IMAGE_BYTES + 1), contentType: "image/png" }
          : images.get(props.input.id);
        if (!image) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return imageOutput(
          {
            body: new Blob([image.bytes]).stream(),
            contentType: image.contentType,
            etag: "test-etag",
          },
          props.ctx.request.signal,
        );
      }),
  }),
});

const app = new Hono();
app.use("/api/trpc/*", limitTrpcRequestBody);
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router,
    createContext: (_options, context) => ({ request: context.req.raw }),
  }),
);

const PROBE_CHUNK_BYTES = 64 * 1024;

function oversizedImageRequest() {
  const form = new FormData();
  form.set("id", "probe");
  form.set("padding", "a".repeat(TRPC_MAX_BODY_BYTES + PROBE_CHUNK_BYTES));
  form.set(
    "file",
    new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "image.png", {
      type: "image/png",
    }),
  );
  return new Request("http://fixture/api/trpc/product.addImage", {
    method: "POST",
    body: form,
  });
}

async function probe(url: URL) {
  const encoded = oversizedImageRequest();
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  const headers = new Headers(encoded.headers);
  const role = url.searchParams.get("role");
  if (role) {
    headers.set("x-test-role", role);
  }

  const length = url.searchParams.get("length");
  if (length) {
    headers.set("content-length", length);
  } else {
    headers.delete("content-length");
  }

  let pulls = 0;
  let cancellations = 0;
  let offset = 0;
  const source = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls += 1;
        if (offset === bytes.byteLength) {
          controller.close();
          return;
        }

        const end = Math.min(offset + PROBE_CHUNK_BYTES, bytes.byteLength);
        controller.enqueue(bytes.subarray(offset, end));
        offset = end;
      },
      cancel() {
        cancellations += 1;
      },
    },
    { highWaterMark: 0 },
  );
  // HTTP送信側のContent-Length補正を避け、workerdのRequestとformDataを直接通す。
  const response = await app.fetch(
    new Request(encoded.url, { method: "POST", headers, body: source }),
  );
  return Response.json({
    status: response.status,
    body: await response.json(),
    pulls,
    cancellations,
    bytesPulled: offset,
    stoppedBeforeEnd: offset < bytes.byteLength,
    sourceLocked: source.locked,
    uploaded: images.has("probe"),
  });
}

export default {
  fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/probe") {
      return probe(url);
    }

    return app.fetch(request);
  },
};
