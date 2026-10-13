import { createMemoryHistory } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { RouteAccessState } from "@dev-template/client/route-access";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/apps/web/src/_app/server/route-access.ts", () => ({ getRouteAccess: mocks.read }));
vi.mock("@/apps/business/src/_app/server/route-access.ts", () => ({ getRouteAccess: mocks.read }));
vi.mock("@/apps/admin/src/_app/server/route-access.ts", () => ({ getRouteAccess: mocks.read }));

async function routerFor(app: string, path: string): Promise<AnyRouter> {
  const module = await import(`../apps/${app}/app/router.ts`);
  const router = module.getRouter();
  router.update({ history: createMemoryHistory({ initialEntries: [path] }), isServer: false });
  await router.load();
  return router;
}

beforeEach(() => {
  mocks.read.mockReset().mockResolvedValue("registered" satisfies RouteAccessState);
});
for (const app of ["web", "business", "admin"]) {
  describe(`${app}の遷移前チェック`, () => {
    it("公開ログイン・招待は資格照会を開始しない", async () => {
      await routerFor(app, "/sign-in");
      await routerFor(app, "/invitations/accept");
      expect(mocks.read).not.toHaveBeenCalled();
    });
    it("accountは本人確認だけで、資格喪失後にも利用できる", async () => {
      const router = await routerFor(app, "/account");
      expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
      expect(mocks.read).toHaveBeenCalledExactlyOnceWith({ data: { qualified: false } });
    });
    it("未登録では業務資格を取得せず、登録・招待の案内へ進める", async () => {
      mocks.read.mockResolvedValue("unregistered");
      const router = await routerFor(app, app === "web" ? "/checkout" : "/");
      expect(router.state.location.pathname).toBe(app === "web" ? "/register" : "/account");
      expect(mocks.read.mock.calls.every((props) => props[0].data.qualified === false)).toBe(true);
    });
    it("未ログインはfragmentを含めず、元のパスを付けてログインへ移す", async () => {
      mocks.read.mockResolvedValue("signed-out");
      const router = await routerFor(app, "/account?mode=edit#secret");
      expect(router.state.location.pathname).toBe("/sign-in");
      expect(new URLSearchParams(router.state.location.searchStr).get("returnTo")).toBe(
        "/account?mode=edit",
      );
    });
    it("資格拒否では業務ページのロードを成功させない", async () => {
      mocks.read.mockResolvedValueOnce("registered").mockResolvedValueOnce("forbidden");
      const router = await routerFor(app, app === "web" ? "/checkout" : "/");
      expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
    });
  });
}

for (const app of ["business"]) {
  it(`${app}: 直接アクセス・画面遷移で遷移先の復号済み企業IDを照会する`, async () => {
    const router = await routerFor(app, "/organizations/tenant%252Fa");
    expect(mocks.read).toHaveBeenLastCalledWith({
      data: { qualified: true, organizationId: "tenant%2Fa" },
    });
    await router.navigate({ to: "/organizations/tenant-b" });
    expect(mocks.read).toHaveBeenLastCalledWith({
      data: { qualified: true, organizationId: "tenant-b" },
    });
  });
}

for (const app of ["web", "business"]) {
  describe(`${app}のパスパラメーター検証`, () => {
    it.each(["%20", "%20tenant", "tenant%20", "tenant%0Aevil", "tenant%00evil", "a".repeat(201)])(
      "不正な企業パス %s は認証・資格の照会前に拒否する",
      async (id) => {
        const router = await routerFor(app, `/organizations/${id}`);
        expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
        expect(mocks.read).not.toHaveBeenCalled();
      },
    );
  });
}

for (const app of ["web", "business", "admin"]) {
  it(`${app}: ログインの可変パスも制御文字を拒否する`, async () => {
    const router = await routerFor(app, "/sign-in/sso%0Acallback");
    expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
    expect(mocks.read).not.toHaveBeenCalled();
  });
}

for (const path of ["/organizations/%20tenant/products", "/organizations/tenant%0D%0A/members"]) {
  it(`businessの子画面 ${path} も照会前に拒否する`, async () => {
    const router = await routerFor("business", path);
    expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
    expect(mocks.read).not.toHaveBeenCalled();
  });
}

for (const app of ["web", "business", "admin"]) {
  it(`${app}: 正常なログインの複数段パスはSDKへ渡す`, async () => {
    const router = await routerFor(app, "/sign-in/factor-one/verify");
    expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
    expect(mocks.read).not.toHaveBeenCalled();
  });
}

describe("公開ストアと本人購入の入口", () => {
  it.each(["/", "/cart", "/products/tenant-a/item", "/organizations/tenant-a"])(
    "公開%sは未ログインでも資格照会しない",
    async (path) => {
      mocks.read.mockResolvedValue("signed-out");
      const router = await routerFor("web", path);
      expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
      expect(mocks.read).not.toHaveBeenCalled();
    },
  );
  it.each([
    "/checkout",
    "/orders",
    "/orders/00000000-0000-4000-8000-000000000001",
    "/orders/00000000-0000-4000-8000-000000000001/complete",
  ])("本人購入%sは企業所属なしで本人資格を照会する", async (path) => {
    const router = await routerFor("web", path);
    expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
    expect(mocks.read).toHaveBeenLastCalledWith({
      data: { qualified: true, organizationId: undefined },
    });
  });
  it("商品パスの不正SKUを描画前に拒否する", async () => {
    const router = await routerFor("web", "/products/tenant-a/%20invalid");
    expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
