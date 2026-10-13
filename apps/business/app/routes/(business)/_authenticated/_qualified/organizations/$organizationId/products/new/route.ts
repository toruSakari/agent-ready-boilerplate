import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { NewProductPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/products/new/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/products/new/",
)({ params: organizationPathParams, component: NewProductPage });
