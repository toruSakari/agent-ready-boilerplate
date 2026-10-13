import { createFileRoute } from "@tanstack/react-router";
import { CompletePage } from "#app/routes/(web)/_authenticated/_qualified/orders/$orderId/complete/-page.tsx";
import { orderPathParams } from "#web/shared/config/store-route-params.ts";

export const Route = createFileRoute("/(web)/_authenticated/_qualified/orders/$orderId/complete/")({
  params: orderPathParams,
  component: CompletePage,
});
