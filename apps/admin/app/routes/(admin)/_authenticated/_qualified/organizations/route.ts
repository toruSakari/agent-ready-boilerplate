import { organizationListSearchSchema } from "@dev-template/client/list-filters";
import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsPage } from "#app/routes/(admin)/_authenticated/_qualified/organizations/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified/organizations/")({
  validateSearch: organizationListSearchSchema,
  component: OrganizationsPage,
});
