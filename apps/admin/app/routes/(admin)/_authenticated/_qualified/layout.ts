import { RouteAccessError } from "@dev-template/client/route-access-error";
import { qualifiedBeforeLoad } from "@dev-template/client/route-access";
import { readRouteAccess } from "#admin/_app/navigation/route-access.ts";
import { createFileRoute } from "@tanstack/react-router";
import { QualifiedLayout } from "#app/routes/(admin)/_authenticated/_qualified/-layout.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified")({
  beforeLoad: qualifiedBeforeLoad(readRouteAccess, "/account"),
  errorComponent: RouteAccessError,
  component: QualifiedLayout,
});
