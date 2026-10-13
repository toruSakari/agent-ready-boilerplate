import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsOrganizationidAuditPage } from "#app/routes/(admin)/_authenticated/_qualified/organizations/$organizationId/audit/-page.tsx";

export const Route = createFileRoute(
  "/(admin)/_authenticated/_qualified/organizations/$organizationId/audit/",
)({ params: organizationPathParams, component: OrganizationsOrganizationidAuditPage });
