// @vitest-environment node
import { beforeEach, expect, it, vi } from "vite-plus/test";
import web from "@/apps/web/worker-entry.ts";
import business from "@/apps/business/worker-entry.ts";
import admin from "@/apps/admin/worker-entry.ts";

const mocks = vi.hoisted(() => ({ start: vi.fn(), synchronize: vi.fn(), api: { fetch: vi.fn() } }));
vi.mock("cloudflare:workers", () => ({ env: { API: mocks.api } }));
vi.mock("@tanstack/react-start/server", () => ({
  createStartHandler: () => mocks.start,
  defaultStreamHandler: vi.fn(),
}));
vi.mock("@dev-template/config/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dev-template/config/auth")>()),
  synchronizeFrontendSession: mocks.synchronize,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.start.mockImplementation(
    async () => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }),
  );
});
for (const [name, worker] of Object.entries({ web, business, admin })) {
  it(`${name}: 要求nonceを上書きし、Startへ渡し、同期Cookieをすべて保持する`, async () => {
    const headers = new Headers({
      "x-frontend-continue": "1",
      "Cache-Control": "private, no-store",
    });
    headers.append("Set-Cookie", "__session=new; HttpOnly; Secure");
    headers.append("Set-Cookie", "__client_uat=0; Max-Age=0");
    mocks.synchronize.mockResolvedValue(new Response(null, { headers }));
    const response = await worker.fetch(
      new Request("https://app.example.com/account", { headers: { "x-csp-nonce": "forged" } }),
    );
    const [request, options] = mocks.start.mock.calls[0]!;
    const nonce = request.headers.get("x-csp-nonce");
    expect(nonce).not.toBe("forged");
    expect(options.context.nonce).toBe(nonce);
    expect(response.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
    expect(response.headers.has("x-frontend-continue")).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it(`${name}: 同期の拒否・外部ハンドシェイクではStartを起動しない`, async () => {
    mocks.synchronize.mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: {
          Location: "https://clerk.example.com/handshake",
          "Set-Cookie": "__client_uat=0",
        },
      }),
    );
    const response = await worker.fetch(new Request("https://app.example.com/account"));
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://clerk.example.com/handshake");
    expect(response.headers.getSetCookie()).toEqual(["__client_uat=0"]);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it(`${name}: APIはStartとCookie同期を通さず、Service Bindingへ転送する`, async () => {
    mocks.api.fetch.mockResolvedValue(Response.json({ ok: true }));
    const response = await worker.fetch(
      new Request("https://app.example.com/api/trpc/order.list", {
        headers: { Authorization: "Bearer test", "x-organization-id": "tenant-a" },
      }),
    );
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.api.fetch.mock.calls[0]?.[1].headers).toMatchObject({
      authorization: "Bearer test",
      "x-organization-id": "tenant-a",
    });
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.synchronize).not.toHaveBeenCalled();
  });
}
