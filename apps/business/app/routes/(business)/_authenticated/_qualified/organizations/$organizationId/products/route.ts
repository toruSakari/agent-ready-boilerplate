import { listSearchSchema } from "@dev-template/client/list-filters";
import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/products/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/products/",
)({ params: organizationPathParams, validateSearch: listSearchSchema, component: ProductsPage });
