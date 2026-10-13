import { orderListSearchSchema } from "@dev-template/client/list-filters";
import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/orders/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/orders/",
)({ params: organizationPathParams, validateSearch: orderListSearchSchema, component: OrdersPage });
