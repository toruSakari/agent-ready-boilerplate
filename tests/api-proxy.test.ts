import { describe, it, expect, vi } from "vite-plus/test";
import { proxyApiRequest } from "@dev-template/config/proxy";

it("画面から共通APIへのプロキシ / 認証・企業ID・Access JWTを保持し、個人情報の共有キャッシュを防ぐ", async () => {
  const api = {
    fetch: vi
      .fn()
      .mockResolvedValue(new Response("{}", { headers: { "Cache-Control": "public" } })),
  };
  const response = await proxyApiRequest(
    new Request("https://admin.example.com/api/trpc/access.users", {
      headers: {
        authorization: "Bearer test-token",
        "x-organization-id": "tenant-a",
        "cf-access-jwt-assertion": "test-assertion",
      },
    }),
    api,
  );
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(api.fetch.mock.calls[0]?.[1].headers).toMatchObject({
    authorization: "Bearer test-token",
    "x-organization-id": "tenant-a",
    "cf-access-jwt-assertion": "test-assertion",
  });
});

it.each([401, 429])(
  "画面から共通APIへのプロキシ / APIの拒否%sより前に本文を読まない",
  async (status) => {
    const pull = vi.fn();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    const api = { fetch: vi.fn().mockResolvedValue(new Response(null, { status })) };
    const response = await proxyApiRequest(
      new Request("https://business.example.com/api/trpc/product.addImage", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit),
      api,
    );
    expect(response.status).toBe(status);
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  },
);

it("画面から共通APIへのプロキシ / 明示されたサービスの入力を変更せず共通APIへ渡す", async () => {
  const body = JSON.stringify({ "0": { service: "operator", scope: "platform" } });
  let received = "";
  const api = {
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      received = await new Request(url, { ...init, duplex: "half" } as RequestInit).text();
      return Response.json({ ok: true });
    }),
  };
  await proxyApiRequest(
    new Request("https://web.example.com/api/trpc/access.invite?batch=1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
    api,
  );
  expect(received).toBe(body);
});

// 画面ホストからサービス権限を推測しないため、どの入口でも転送可能なパスを同じ条件で検証する。
for (const host of ["web", "business", "admin"] as const) {
  describe(`${host}の共通API転送`, () => {
    it.each([
      "/api/health",
      "/api/trpc/access.session?batch=1",
      "/api/trpc/access.users?batch=1",
      "/api/trpc/product.getImage",
      "/api/trpc/product.addImage",
    ])("同じ入口%sを転送し認可を共通APIに委ねる", async (path) => {
      const api = { fetch: vi.fn().mockResolvedValue(Response.json({ ok: true })) };
      const url = `https://${host}.example.com${path}`;
      const response = await proxyApiRequest(new Request(url), api);
      expect(response.status).toBe(200);
      expect(api.fetch.mock.calls[0]?.[0]).toBe(url);
    });
    it.each([
      "/api/admin/trpc/access.users",
      "/api/business/trpc/access.session",
      "/api/customer/trpc/access.session",
      "/api/customer/trpc/access.acceptInvitation",
      "/api/customer/products/product-1/image",
      "/api/business/trpc-other/access.session",
      "/api/trpc-other/access.session",
      "/api/admin/trpc-other/access.session",
      "/api/unknown/trpc/access.session",
      "/api/business/unknown",
      "/api/customer/unknown",
      "/api/products-other/product-1/image",
      "/api/products/product-1/image",
      "/api/products/product-1/images/image-1",
    ])("未定義・廃止された%sを404で拒否する", async (path) => {
      const api = { fetch: vi.fn() };
      const response = await proxyApiRequest(
        new Request(`https://${host}.example.com${path}`),
        api,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(api.fetch).not.toHaveBeenCalled();
    });
  });
}

it.each(["203.0.113.5", null])(
  "接続元IPの転送 / 任意のX-Real-IPを信用せずCloudflare接続元%sで置き換える",
  async (clientIp) => {
    const api = { fetch: vi.fn().mockResolvedValue(Response.json({ ok: true })) };
    const headers = new Headers({ "x-real-ip": "198.51.100.1" });
    if (clientIp) {
      headers.set("cf-connecting-ip", clientIp);
    }

    await proxyApiRequest(
      new Request("https://business.example.com/api/trpc/order.list", { headers }),
      api,
    );
    const forwarded = new Headers(api.fetch.mock.calls[0]?.[1].headers);
    expect(forwarded.get("x-real-ip")).toBe(clientIp);
    expect(forwarded.get("cf-connecting-ip")).toBe(clientIp);
  },
);
