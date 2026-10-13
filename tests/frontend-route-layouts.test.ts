import type { AnyRouter } from "@tanstack/react-router";
// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vite-plus/test";
import { AuthenticationGate, ServiceQualificationGate } from "@dev-template/client/guards";
import { AuthenticatedLayout as WebAuth } from "@/apps/web/app/routes/(web)/_authenticated/-layout.tsx";
import { QualifiedLayout as WebQualified } from "@/apps/web/app/routes/(web)/_authenticated/_qualified/-layout.tsx";
import { AuthenticatedLayout as BusinessAuth } from "@/apps/business/app/routes/(business)/_authenticated/-layout.tsx";
import { QualifiedLayout as BusinessQualified } from "@/apps/business/app/routes/(business)/_authenticated/_qualified/-layout.tsx";
import { AuthenticatedLayout as AdminAuth } from "@/apps/admin/app/routes/(admin)/_authenticated/-layout.tsx";
import { QualifiedLayout as AdminQualified } from "@/apps/admin/app/routes/(admin)/_authenticated/_qualified/-layout.tsx";

vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("cloudflare:workers", () => ({ env: {} }));

// 各アプリのRegisterを同じTypeScript programへ取り込まず、実ルートの検証は動的に行う。
const routerFor = async (app: string): Promise<AnyRouter> => {
  const module = await import(`../apps/${app}/app/router.ts`);
  return module.getRouter();
};
const applications = [
  {
    app: "web",
    service: "customer",
    getRouter: () => routerFor("web"),
    auth: WebAuth,
    qualified: WebQualified,
    qualifiedUrls: [
      "/checkout",
      "/orders",
      "/orders/00000000-0000-4000-8000-000000000001",
      "/orders/00000000-0000-4000-8000-000000000001/complete",
    ],
    publicUrls: [
      "/",
      "/cart",
      "/products/tenant-a/item",
      "/organizations/tenant-a",
      "/sign-in",
      "/sign-in/factor-two",
      "/invitations/accept",
      "/register",
    ],
  },
  {
    app: "business",
    service: "business",
    getRouter: () => routerFor("business"),
    auth: BusinessAuth,
    qualified: BusinessQualified,
    qualifiedUrls: [
      "/",
      "/organizations/tenant-a",
      "/organizations/tenant-a/products",
      "/organizations/tenant-a/members",
    ],
    publicUrls: ["/sign-in", "/sign-in/factor-two", "/invitations/accept"],
  },
  {
    app: "admin",
    service: "operator",
    getRouter: () => routerFor("admin"),
    auth: AdminAuth,
    qualified: AdminQualified,
    qualifiedUrls: ["/"],
    publicUrls: ["/sign-in", "/sign-in/factor-two", "/invitations/accept"],
  },
] as const;

for (const application of applications) {
  const { app, service } = application;
  const router = await application.getRouter();

  const ids = (path: string) => router.matchRoutes(path).map((match) => match.routeId);
  const authId = `/(${app})/_authenticated`;
  const qualifiedId = `${authId}/_qualified`;
  it("本人確認と利用資格のガードをアプリのlayoutに明示する", () => {
    expect(application.auth().type).toBe(AuthenticationGate);
    const element = application.qualified();
    expect(element.type).toBe(ServiceQualificationGate);
    expect(element.props.service).toBe(service);
    if (app === "web") {
      expect(element.props.missingRegistrationContent).toBeTruthy();
    }
  });
  it.each(application.qualifiedUrls)("%sを本人確認・サービス資格の順で保護する", (path) => {
    const matched = ids(path);
    expect(matched.slice(0, 3)).toEqual(["__root__", authId, qualifiedId]);
    expect(router.matchRoutes(path).at(-1)?.pathname.replace(/\/$/, "") || "/").toBe(path);
  });
  it("/accountは本人確認だけを要求し、資格喪失後も利用できる", () => {
    expect(ids("/account")).toEqual(["__root__", authId, `${authId}/account/`]);
  });
  it.each(application.publicUrls)("公開入口%sにガードを適用しない", (path) => {
    const matched = ids(path);
    expect(matched).not.toContain(authId);
    expect(matched).not.toContain(qualifiedId);
    expect(router.matchRoutes(path).at(-1)?.pathname.replace(/\/$/, "") || "/").toBe(path);
  });
  it("root Providerにページの利用条件を持たせない", async () => {
    const source = await readFile(`apps/${app}/app/root-layout.tsx`, "utf8");
    expect(source).not.toMatch(/AuthenticationGate|ServiceQualificationGate/);
  });
  if (app !== "admin") {
    it.each([
      ["tenant-a", "tenant-a"],
      ["tenant%2Da", "tenant-a"],
      ["tenant%252Da", "tenant%2Da"],
      ["tenant%25252Fa", "tenant%252Fa"],
      ["tenant%2Fa", "tenant/a"],
      ["tenant%23%3F%2B", "tenant#?+"],
    ])("企業ID %sを一度だけ復号する", (segment, expected) => {
      const match = router.matchRoutes(`/organizations/${segment}`).at(-1);
      expect(
        match && "organizationId" in match.params ? match.params.organizationId : undefined,
      ).toBe(expected);
    });
    it.each(["tenant%", "tenant%ZZ", "tenant%E0%A4%A"])("不正な企業ID %sを拒否する", (segment) => {
      expect(
        router
          .matchRoutes(`/organizations/${segment}`)
          .some((match) => "organizationId" in match.params),
      ).toBe(false);
    });
    it("ProviderはRouterが復号した企業IDをそのまま使う", async () => {
      const source = await readFile(`apps/${app}/src/_app/providers/app-providers.tsx`, "utf8");
      if (app === "business") {
        expect(source).toContain("useRouterState");
      } else {
        expect(source).toContain('organizationId=""');
      }

      expect(source).not.toContain("decodeURIComponent");
    });
  }
}

it("フロントエンドの認可責務 / APIはWorkerからBindingへ転送し、ルートへ業務APIを複製しない", async () => {
  for (const { app } of applications) {
    const worker = await readFile(`apps/${app}/worker-entry.ts`, "utf8");
    expect(worker).toContain("proxyApiRequest(request, env.API)");
    expect(worker).toContain("decision.headers.getSetCookie()");
    expect(worker).toContain('request.headers.get("x-csp-nonce")');
  }
});

it("フロントエンドの認可責務 / 共有Providerには公開ルート判定・サービス固有メニューを置かない", async () => {
  const provider = await readFile("packages/client/src/_app/providers/app-providers.tsx", "utf8");
  expect(provider).not.toMatch(
    /AuthenticationGate|ServiceQualificationGate|isPublicPath|window\.location\.pathname/,
  );
  for (const file of ["console-layout", "access-console"]) {
    const source = await readFile(
      `packages/client/src/widgets/access-console/ui/${file}.tsx`,
      "utf8",
    );
    expect(source).not.toMatch(/\/(?:products|members)\b/);
  }
});
