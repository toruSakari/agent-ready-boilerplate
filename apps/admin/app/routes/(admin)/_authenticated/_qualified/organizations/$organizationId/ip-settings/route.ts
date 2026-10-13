import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsOrganizationidIpSettingsPage } from "#app/routes/(admin)/_authenticated/_qualified/organizations/$organizationId/ip-settings/-page.tsx";

export const Route = createFileRoute(
  "/(admin)/_authenticated/_qualified/organizations/$organizationId/ip-settings/",
)({ params: organizationPathParams, component: OrganizationsOrganizationidIpSettingsPage });
