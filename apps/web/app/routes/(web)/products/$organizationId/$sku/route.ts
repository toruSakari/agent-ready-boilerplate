import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "#app/routes/(web)/products/$organizationId/$sku/-page.tsx";
import { productPathParams } from "#web/shared/config/store-route-params.ts";

export const Route = createFileRoute("/(web)/products/$organizationId/$sku/")({
  params: productPathParams,
  component: ProductPage,
});
