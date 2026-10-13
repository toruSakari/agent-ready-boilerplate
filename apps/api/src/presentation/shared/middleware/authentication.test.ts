import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { authenticateRequest } from "#api/presentation/shared/middleware/authentication.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn<ServiceIdentityProvider["authenticate"]>(),
  createContainer: vi.fn(),
  next: vi.fn(),
}));
vi.mock("#api/composition-root.ts", () => ({ createContainer: mocks.createContainer }));
const app = new Hono<RequestActorEnv>();
app.use("/*", authenticateRequest);
app.get("/", (context) => {
  mocks.next(context.var);
  return context.json({ ok: true });
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.createContainer.mockReturnValue({ identityProvider: { authenticate: mocks.authenticate } });
  mocks.authenticate.mockResolvedValue({
    userId: "subject-1",
    tenantId: "",
    role: "member",
    permissions: [],
  });
});
describe("要求単位の本人確認", () => {
  it("本人情報を一度だけ取得し、同じ参照を後段へ渡す", async () => {
    const response = await app.request("https://example.com/");
    expect(response.status).toBe(200);
    expect(mocks.createContainer).toHaveBeenCalledOnce();
    expect(mocks.authenticate).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
    expect(mocks.next.mock.calls[0]?.[0].actor).toBe(
      await mocks.authenticate.mock.results[0]?.value,
    );
    expect(mocks.next.mock.calls[0]?.[0].authenticationError).toBeUndefined();
  });
  it("認証失敗を投げ直さず、通信方式ごとのエラー変換へ渡す", async () => {
    const error = new Error("認証失敗");
    mocks.authenticate.mockRejectedValue(error);
    expect((await app.request("https://example.com/")).status).toBe(200);
    expect(mocks.next).toHaveBeenCalledExactlyOnceWith({
      container: mocks.createContainer.mock.results[0]?.value,
      actor: undefined,
      authenticationError: error,
    });
  });
  it("依存の生成失敗も未認証のまま後段へ渡す", async () => {
    const error = new Error("依存生成失敗");
    mocks.createContainer.mockImplementation(() => {
      throw error;
    });
    expect((await app.request("https://example.com/")).status).toBe(200);
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.next).toHaveBeenCalledExactlyOnceWith({
      container: undefined,
      actor: undefined,
      authenticationError: error,
    });
  });
});
