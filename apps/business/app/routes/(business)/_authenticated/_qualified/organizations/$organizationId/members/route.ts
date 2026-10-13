import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { MembersPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/members/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/members/",
)({ params: organizationPathParams, component: MembersPage });
