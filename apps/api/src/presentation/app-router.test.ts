import { inventoryRouter } from "#api/presentation/inventory/trpc-router.ts";
import { describe, expect, it } from "vite-plus/test";
import { appRouter } from "#api/presentation/app-router.ts";
import { accessRouter } from "#api/presentation/access/trpc-router.ts";
import { orderRouter } from "#api/presentation/order/trpc-router.ts";
import { productRouter } from "#api/presentation/product/trpc-router.ts";
import { storeRouter } from "#api/presentation/store/trpc-router.ts";
import { dashboardRouter } from "#api/presentation/dashboard/trpc-router.ts";
import { apiApp } from "#api/presentation/api-app.ts";

const accessProcedures = [
  "businessIpPolicy",
  "updateBusinessIpPolicy",
  "plans",
  "organizationPlan",
  "customerPlans",
  "changeCustomerPlan",
  "assignPlan",
  "registration",
  "registerCustomer",
  "withdraw",
  "session",
  "organizations",
  "organizationDirectory",
  "organizationPlanOptions",
  "users",
  "createOrganization",
  "updateOrganization",
  "deleteUser",
  "members",
  "roles",
  "rolePermissionCatalog",
  "saveRole",
  "invite",
  "assignRole",
  "removeMember",
  "acceptInvitation",
  "audit",
];
const orderProcedures = ["get", "update", "transition", "list", "create"];
const productProcedures = [
  "get",
  "update",
  "list",
  "create",
  "getImage",
  "replaceImage",
  "addImage",
  "deleteImage",
];

const storeProcedures = [
  "list",
  "get",
  "getImage",
  "checkout",
  "listOrders",
  "getOrder",
  "cancelOrder",
];
const inventoryProcedures = ["get", "change", "adjust", "history", "list"];
const dashboardProcedures = ["summary"];

describe("業務領域別ルーターと公開操作の構成", () => {
  it("各ルーターはその領域の操作だけを所有する", () => {
    expect(Object.keys(inventoryRouter._def.procedures).sort()).toEqual(
      inventoryProcedures.toSorted(),
    );
    expect(Object.keys(storeRouter._def.procedures).sort()).toEqual(storeProcedures.toSorted());
    expect(Object.keys(dashboardRouter._def.procedures).sort()).toEqual(
      dashboardProcedures.toSorted(),
    );
    expect(Object.keys(accessRouter._def.procedures).sort()).toEqual(accessProcedures.toSorted());
    expect(Object.keys(orderRouter._def.procedures).sort()).toEqual(orderProcedures.toSorted());
    expect(Object.keys(productRouter._def.procedures).sort()).toEqual(productProcedures.toSorted());
  });
  it("IP制限を含む公開RPC名を検証する", () => {
    expect(Object.keys(appRouter._def.procedures).sort()).toEqual(
      [
        ...inventoryProcedures.map((name) => `inventory.${name}`),
        ...storeProcedures.map((name) => `store.${name}`),
        ...dashboardProcedures.map((name) => `dashboard.${name}`),
        ...accessProcedures.map((name) => `access.${name}`),
        ...orderProcedures.map((name) => `order.${name}`),
        ...productProcedures.map((name) => `product.${name}`),
        "health",
      ].sort(),
    );
  });
  it("廃止した画像HTTPルートを接続しない", () => {
    expect(apiApp.routes.filter((route) => route.path.startsWith("/api/products/"))).toEqual([]);
  });
});
