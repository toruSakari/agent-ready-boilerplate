import { orderListSearchSchema } from "@dev-template/client/list-filters";
import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "#app/routes/(web)/_authenticated/_qualified/orders/-page.tsx";

export const Route = createFileRoute("/(web)/_authenticated/_qualified/orders/")({
  validateSearch: orderListSearchSchema,
  component: OrdersPage,
});
