import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

const presentation = "apps/api/src/presentation";
const source = (path: string) => readFileSync(`${presentation}/${path}`, "utf8");

describe("presentationの業務領域ごとの配置", () => {
  it("HTTPアプリはRPC入口を接続し、業務URL・認可・ハンドラーを所有しない", () => {
    const app = source("api-app.ts");
    expect(app).not.toMatch(/image-http-handlers|httpActorGuard|requireHttpPermissions/);
    expect(
      [...app.matchAll(/app\.(?:get|post|put|patch|delete|all)\(\s*"([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ).toEqual(["/health"]);
    expect(app).not.toMatch(/container\.|\/products|\/orders|\/access/);
  });

  it("画像RPCは商品領域で会員・IP制限・権限・入力の順を明示する", () => {
    const router = source("product/trpc-router.ts");
    for (const operation of ["replaceImage", "addImage", "deleteImage"]) {
      expect(router).toMatch(
        new RegExp(
          `${operation}: procedure\\s*\\.use\\(requireActor\\("business"\\)\\)\\s*\\.use\\(requireBusinessIp\\)\\s*\\.use\\(requirePermissions\\(\\["product.read", "product.update"\\]\\)\\)\\s*\\.input`,
        ),
      );
    }
  });

  it("RPCは各領域で操作と認可を宣言し、全体ルーターは業務処理を持たない", () => {
    const app = source("app-router.ts");
    for (const domain of ["access", "order", "product"]) {
      expect(app).toContain(`#api/presentation/${domain}/trpc-router.ts`);
      if (domain === "access") {
        for (const area of ["account", "membership", "organization"]) {
          expect(source(`${domain}/trpc-router.ts`)).toContain(
            `#api/presentation/access/${area}-procedures.ts`,
          );
          expect(source(`access/${area}-procedures.ts`)).toContain(".use(requireActor(");
        }
      } else {
        expect(source(`${domain}/trpc-router.ts`)).toContain(".use(requireActor(");
      }
    }

    expect(app).not.toMatch(/container\.|requirePermissions|requireAccessPermissions/);
    expect(source("product/trpc-router.ts")).toContain("ctx.container.products.");
  });
});
