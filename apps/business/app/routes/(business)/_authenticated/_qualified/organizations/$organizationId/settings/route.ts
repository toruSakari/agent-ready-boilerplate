import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/settings/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/settings/",
)({ params: organizationPathParams, component: SettingsPage });
