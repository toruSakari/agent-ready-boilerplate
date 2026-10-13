import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsOrganizationidPage } from "#app/routes/(admin)/_authenticated/_qualified/organizations/$organizationId/-page.tsx";

export const Route = createFileRoute(
  "/(admin)/_authenticated/_qualified/organizations/$organizationId/",
)({ params: organizationPathParams, component: OrganizationsOrganizationidPage });
