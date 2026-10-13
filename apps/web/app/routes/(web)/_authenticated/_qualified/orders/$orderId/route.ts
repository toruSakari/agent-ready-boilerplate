import { createFileRoute } from "@tanstack/react-router";
import { OrderPage } from "#app/routes/(web)/_authenticated/_qualified/orders/$orderId/-page.tsx";
import { orderPathParams } from "#web/shared/config/store-route-params.ts";

export const Route = createFileRoute("/(web)/_authenticated/_qualified/orders/$orderId/")({
  params: orderPathParams,
  component: OrderPage,
});
