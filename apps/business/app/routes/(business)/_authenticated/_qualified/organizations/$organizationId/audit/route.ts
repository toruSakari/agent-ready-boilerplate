import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { Page } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/audit/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/audit/",
)({ params: organizationPathParams, component: Page });
