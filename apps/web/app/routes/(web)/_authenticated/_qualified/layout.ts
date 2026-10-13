import { RouteAccessError } from "@dev-template/client/route-access-error";
import { qualifiedBeforeLoad } from "@dev-template/client/route-access";
import { readRouteAccess } from "#web/_app/navigation/route-access.ts";
import { createFileRoute } from "@tanstack/react-router";
import { QualifiedLayout } from "#app/routes/(web)/_authenticated/_qualified/-layout.tsx";

export const Route = createFileRoute("/(web)/_authenticated/_qualified")({
  beforeLoad: qualifiedBeforeLoad(readRouteAccess, "/register"),
  errorComponent: RouteAccessError,
  component: QualifiedLayout,
});
