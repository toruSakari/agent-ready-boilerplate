import { RouteAccessError } from "@dev-template/client/route-access-error";
import { authenticatedBeforeLoad } from "@dev-template/client/route-access";
import { readRouteAccess } from "#web/_app/navigation/route-access.ts";
import { createFileRoute } from "@tanstack/react-router";
import { AuthenticatedLayout } from "#app/routes/(web)/_authenticated/-layout.tsx";

export const Route = createFileRoute("/(web)/_authenticated")({
  beforeLoad: authenticatedBeforeLoad(readRouteAccess),
  errorComponent: RouteAccessError,
  component: AuthenticatedLayout,
});
