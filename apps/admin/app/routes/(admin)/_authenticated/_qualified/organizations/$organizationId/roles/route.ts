import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsOrganizationidRolesPage } from "#app/routes/(admin)/_authenticated/_qualified/organizations/$organizationId/roles/-page.tsx";

export const Route = createFileRoute(
  "/(admin)/_authenticated/_qualified/organizations/$organizationId/roles/",
)({ params: organizationPathParams, component: OrganizationsOrganizationidRolesPage });
