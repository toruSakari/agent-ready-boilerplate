// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "#api/presentation/app-router.ts";
import { BUSINESS_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { MAX_IMAGE_BYTES } from "#api/application/product/policies/image-policy.ts";
import { TRPC_MAX_BODY_BYTES } from "#api/presentation/shared/middleware/limit-trpc-body.ts";
import { apiApp } from "#api/presentation/api-app.ts";

vi.mock("cloudflare:workers", () => ({ env: { APP_ENV: "local" } }));

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn<ServiceIdentityProvider["authenticate"]>(),
  resolveActor: vi.fn<ServiceIdentityProvider["resolveActor"]>(),
  authorize: vi.fn<ServiceIdentityProvider["authorize"]>(),
  getImage: vi.fn(),
  uploadImage: vi.fn(),
  addImage: vi.fn(),
  deleteImage: vi.fn(),
}));
vi.mock("#api/composition-root.ts", () => ({
  createContainer: () => ({
    access: { assertBusinessIp: async () => {} },
    identityProvider: {
      authenticate: mocks.authenticate,
      resolveActor: mocks.resolveActor,
      authorize: mocks.authorize,
    },
    products: {
      getImage: mocks.getImage,
      uploadImage: mocks.uploadImage,
      addImage: mocks.addImage,
      deleteImage: mocks.deleteImage,
    },
  }),
}));
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function form(bytes = png, type = "image/png") {
  const data = new FormData();
  data.set("id", "p1");
  data.set("file", new File([bytes], "test.png", { type }));
  return data;
}

function query(input: unknown = { id: "p1", service: "business" }) {
  return apiApp.request(
    `/api/trpc/product.getImage?input=${encodeURIComponent(JSON.stringify(input))}`,
  );
}

async function mutation(operation: string, body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    // 実HTTPで受信済みのmultipartを再現し、Nodeの送信側FormData生成器を認可拒否で中断しない。
    const outgoing = new Request("http://localhost", { method: "POST", body });
    return apiApp.request(`/api/trpc/product.${operation}`, {
      method: "POST",
      headers: outgoing.headers,
      body: await outgoing.arrayBuffer(),
    });
  }

  return apiApp.request(`/api/trpc/product.${operation}`, {
    method: "POST",
    ...(body instanceof FormData
      ? { body }
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}

function storedImage() {
  return { body: new Blob([png]).stream(), contentType: "image/png", etag: "etag" };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue({
    userId: "u1",
    tenantId: "t1",
    role: "admin",
    permissions: BUSINESS_PERMISSIONS,
  });
  mocks.resolveActor.mockImplementation(async (actor, selection) => ({
    ...actor,
    channel: selection.service === "operator" ? "admin" : selection.service,
  }));
  mocks.authorize.mockImplementation(async (identity, required) => {
    if (!required.every((permission) => identity.permissions.includes(permission))) {
      throw new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
    }

    return { identity, permissions: identity.permissions, protectedRole: false, platform: false };
  });
  mocks.getImage.mockImplementation(async () => storedImage());
  mocks.deleteImage.mockResolvedValue({ ok: true });
});

it("商品画像の型付きtRPC通信 / 実クライアントで追加・差し替え・取得・代表画像/指定画像の削除を送受信する", async () => {
  const client = createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: "http://localhost/api/trpc",
        fetch: async (url, init) => apiApp.request(new Request(url, init)),
      }),
    ],
  });
  expect(await client.product.addImage.mutate(form())).toEqual({ ok: true });
  expect(await client.product.replaceImage.mutate(form())).toEqual({ ok: true });
  expect(await client.product.getImage.query({ id: "p1", service: "business" })).toEqual({
    base64: "iVBORw0KGgo=",
    contentType: "image/png",
    etag: "etag",
  });
  await client.product.deleteImage.mutate({ id: "p1", imageId: "i1" });
  await client.product.deleteImage.mutate({ id: "p1" });
  expect(mocks.addImage).toHaveBeenCalledWith({
    identity: expect.objectContaining({ tenantId: "t1" }),
    id: "p1",
    bytes: png.buffer,
    contentType: "image/png",
  });
  expect(mocks.uploadImage).toHaveBeenCalledWith({
    identity: expect.objectContaining({ tenantId: "t1" }),
    id: "p1",
    bytes: png.buffer,
    contentType: "image/png",
  });
  expect(mocks.deleteImage).toHaveBeenNthCalledWith(1, {
    identity: expect.objectContaining({ tenantId: "t1" }),
    id: "p1",
    imageId: "i1",
  });
  expect(mocks.deleteImage).toHaveBeenNthCalledWith(2, {
    identity: expect.objectContaining({ tenantId: "t1" }),
    id: "p1",
    imageId: undefined,
  });
});

it.each(["customer", "business"])(
  "商品画像の型付きtRPC通信 / 取得は%sを選択し画像IDを渡す",
  async (service) => {
    const response = await query({ id: "p1", service, imageId: "i1" });
    expect(response.status).toBe(200);
    expect(mocks.resolveActor).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
      { service },
      "",
    );
    expect(mocks.getImage).toHaveBeenCalledWith({
      identity: expect.objectContaining({ tenantId: "t1" }),
      id: "p1",
      imageId: "i1",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  },
);

it.each([undefined, "admin", "unknown", ""])(
  "商品画像の型付きtRPC通信 / 不正なservice=%sは会員解決前に拒否する",
  async (service) => {
    expect((await query({ id: "p1", service })).status).toBe(400);
    expect(mocks.resolveActor).not.toHaveBeenCalled();
    expect(mocks.getImage).not.toHaveBeenCalled();
  },
);

it("商品画像の型付きtRPC通信 / operatorは画像の閲覧対象でないため403", async () => {
  expect((await query({ id: "p1", service: "operator" })).status).toBe(403);
  expect(mocks.resolveActor).not.toHaveBeenCalled();
});

it.each(["addImage", "replaceImage", "deleteImage"])(
  "商品画像の型付きtRPC通信 / %sのbusiness固定を入力から変更できない",
  async (operation) => {
    const data = operation === "deleteImage" ? { id: "p1", service: "customer" } : form();
    if (data instanceof FormData) {
      data.set("service", "customer");
    }

    expect((await mutation(operation, data)).status).toBe(200);
    expect(mocks.resolveActor).toHaveBeenCalledWith(expect.anything(), { service: "business" }, "");
  },
);

it.each(["product.getImage,product.getImage", "product.getImage,product.list"])(
  "商品画像の型付きtRPC通信 / %sの画像混在バッチ全体を実行前に拒否する",
  async (paths) => {
    const input = encodeURIComponent(
      JSON.stringify({
        "0": { id: "p1", service: "business" },
        "1": { id: "p1", service: "business" },
      }),
    );
    const response = await apiApp.request(`/api/trpc/${paths}?batch=1&input=${input}`);
    expect(response.status).toBe(400);
    expect(mocks.getImage).not.toHaveBeenCalled();
    expect(mocks.resolveActor).not.toHaveBeenCalled();
  },
);

const operations = [
  { name: "getImage", invoke: () => query(), handler: "getImage", read: true },
  {
    name: "getImage指定",
    invoke: () => query({ id: "p1", imageId: "i1", service: "business" }),
    handler: "getImage",
    read: true,
  },
  {
    name: "addImage",
    invoke: () => mutation("addImage", form()),
    handler: "addImage",
    read: false,
  },
  {
    name: "replaceImage",
    invoke: () => mutation("replaceImage", form()),
    handler: "uploadImage",
    read: false,
  },
  {
    name: "deleteImage",
    invoke: () => mutation("deleteImage", { id: "p1" }),
    handler: "deleteImage",
    read: false,
  },
  {
    name: "deleteImage指定",
    invoke: () => mutation("deleteImage", { id: "p1", imageId: "i1" }),
    handler: "deleteImage",
    read: false,
  },
] as const;
describe.each(operations)("画像RPCの認可: $name", (props) => {
  it("本人確認・会員解決・現在権限・業務処理の順を保つ", async () => {
    expect((await props.invoke()).status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ channel: "business" }),
      props.read ? ["product.read"] : ["product.read", "product.update"],
    );
    const calls = [mocks.authenticate, mocks.resolveActor, mocks.authorize, mocks[props.handler]];
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i - 1]!.mock.invocationCallOrder[0]).toBeLessThan(
        calls[i]!.mock.invocationCallOrder[0]!,
      );
    }
  });
  it.each(["authentication", "membership", "permissions"] as const)(
    "%s拒否時は業務処理をしない",
    async (stage) => {
      const error = new ApplicationError({
        code: stage === "authentication" ? "UNAUTHORIZED" : "FORBIDDEN",
        message: "操作できません",
      });
      if (stage === "authentication") {
        mocks.authenticate.mockRejectedValue(error);
      }

      if (stage === "membership") {
        mocks.resolveActor.mockRejectedValue(error);
      }

      if (stage === "permissions") {
        mocks.authorize.mockRejectedValue(error);
      }

      const response = await props.invoke();
      expect(response.status).toBe(stage === "authentication" ? 401 : 403);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(mocks[props.handler]).not.toHaveBeenCalled();
    },
  );
  it.each(props.read ? ["product.read"] : ["product.read", "product.update"])(
    "%s不足を拒否する",
    async (missing) => {
      mocks.authenticate.mockResolvedValue({
        userId: "u1",
        tenantId: "t1",
        role: "admin",
        permissions: BUSINESS_PERMISSIONS.filter((permission) => permission !== missing),
      });
      expect((await props.invoke()).status).toBe(403);
      expect(mocks[props.handler]).not.toHaveBeenCalled();
    },
  );
});

it.each(["addImage", "replaceImage"])(
  "画像アップロードの有界入力 / %sは5MiBちょうどのファイルを受け入れる",
  async (operation) => {
    expect((await mutation(operation, form(new Uint8Array(MAX_IMAGE_BYTES)))).status).toBe(200);
  },
);

it.each(["addImage", "replaceImage"])(
  "画像アップロードの有界入力 / %sはファイル本体の5MiB超過を413で拒否する",
  async (operation) => {
    const response = await mutation(operation, form(new Uint8Array(MAX_IMAGE_BYTES + 1)));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { data: { code: "PAYLOAD_TOO_LARGE" } },
    });
    expect(mocks.addImage).not.toHaveBeenCalled();
    expect(mocks.uploadImage).not.toHaveBeenCalled();
  },
);

it.each(["image/svg+xml", "text/plain", ""])(
  "画像アップロードの有界入力 / MIME=%sを400で拒否する",
  async (type) => {
    expect((await mutation("addImage", form(png, type))).status).toBe(400);
    expect(mocks.addImage).not.toHaveBeenCalled();
  },
);

it("画像アップロードの有界入力 / 空ファイルと複数ファイルを拒否する", async () => {
  expect((await mutation("addImage", form(new Uint8Array()))).status).toBe(400);
  const data = form();
  data.append("file", new File([png], "other.png", { type: "image/png" }));
  expect((await mutation("addImage", data)).status).toBe(400);
});

it.each(["authentication", "membership", "permissions"] as const)(
  "画像アップロードの有界入力 / %s失敗はmultipartの1byteも読まない",
  async (stage) => {
    const error = new ApplicationError({
      code: stage === "authentication" ? "UNAUTHORIZED" : "FORBIDDEN",
      message: "操作できません",
    });
    if (stage === "authentication") {
      mocks.authenticate.mockRejectedValue(error);
    }

    if (stage === "membership") {
      mocks.resolveActor.mockRejectedValue(error);
    }

    if (stage === "permissions") {
      mocks.authorize.mockRejectedValue(error);
    }

    const pull = vi.fn();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    const request = new Request("http://localhost/api/trpc/product.addImage", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body,
      duplex: "half",
    } as RequestInit);
    const response = await apiApp.request(request);
    expect(response.status).toBe(stage === "authentication" ? 401 : 403);
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  },
);

it.each([undefined, "1", String(TRPC_MAX_BODY_BYTES + 1)])(
  "画像アップロードの有界入力 / Content-Length=%sでも実測の総量超過をtRPC413で返す",
  async (length) => {
    const cancel = vi.fn();
    const chunks = [
      new TextEncoder().encode(
        '--x\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n',
      ),
      new Uint8Array(TRPC_MAX_BODY_BYTES),
      new Uint8Array([1]),
    ];
    const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) => {
      const chunk = chunks.shift();
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    });
    const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    const headers = new Headers({ "content-type": "multipart/form-data; boundary=x" });
    if (length) {
      headers.set("content-length", length);
    }

    const response = await apiApp.request(
      new Request("http://localhost/api/trpc/product.addImage", {
        method: "POST",
        headers,
        body,
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { data: { code: "PAYLOAD_TOO_LARGE" } },
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(pull).toHaveBeenCalledTimes(2);
    expect(body.locked).toBe(false);
    expect(mocks.addImage).not.toHaveBeenCalled();
  },
);

it.each([
  ["NOT_FOUND", 404],
  ["CONFLICT", 409],
] as const)("画像RPCのエラーと廃止URL / %sをHTTP%sへ変換する", async (code, status) => {
  mocks.getImage.mockRejectedValue(new ApplicationError({ code, message: "画像を取得できません" }));
  const response = await query();
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({
    error: { message: "画像を取得できません", data: { code } },
  });
});

it("画像RPCのエラーと廃止URL / 内部例外・スタック・秘密を応答やログに公開しない", async () => {
  mocks.getImage.mockRejectedValue(new Error("private-token"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await query();
    expect(response.status).toBe(500);
    const result = await response.json();
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(JSON.stringify(result)).not.toContain('"stack"');
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-token");
  } finally {
    log.mockRestore();
  }
});

it.each(["/api/products/p1/image", "/api/products/p1/images", "/api/products/p1/images/i1"])(
  "画像RPCのエラーと廃止URL / %sに旧ルートを残さない",
  async (path) => {
    for (const method of ["GET", "POST", "DELETE"]) {
      expect((await apiApp.request(path, { method })).status).toBe(404);
    }
  },
);
