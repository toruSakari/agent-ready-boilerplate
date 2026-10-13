import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/",
)({ params: organizationPathParams, component: HomePage });
