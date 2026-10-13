import { inventoryRouter } from "#api/presentation/inventory/trpc-router.ts";
import { storeRouter } from "#api/presentation/store/trpc-router.ts";
import { dashboardRouter } from "#api/presentation/dashboard/trpc-router.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";
import { accessRouter } from "#api/presentation/access/trpc-router.ts";
import { orderRouter } from "#api/presentation/order/trpc-router.ts";
import { productRouter } from "#api/presentation/product/trpc-router.ts";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  serviceSchema,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";

// 公開名の接続だけを担い、業務操作と認可宣言は各領域のルーターが所有する。
export const appRouter = t.router({
  inventory: inventoryRouter,
  store: storeRouter,
  dashboard: dashboardRouter,
  access: accessRouter,
  health: procedure
    .use(requireActor(ACCOUNT_CATEGORIES))
    .use(requireBusinessIp)
    .input(serviceSchema)
    .query(() => ({ status: "ok" as const })),
  product: productRouter,
  order: orderRouter,
});

export type AppRouter = typeof appRouter;
