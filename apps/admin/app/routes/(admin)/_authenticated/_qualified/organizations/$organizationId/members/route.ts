import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsOrganizationidMembersPage } from "#app/routes/(admin)/_authenticated/_qualified/organizations/$organizationId/members/-page.tsx";

export const Route = createFileRoute(
  "/(admin)/_authenticated/_qualified/organizations/$organizationId/members/",
)({ params: organizationPathParams, component: OrganizationsOrganizationidMembersPage });
