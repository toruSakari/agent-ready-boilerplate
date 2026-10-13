import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsNewPage } from "#app/routes/(admin)/_authenticated/_qualified/organizations/new/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified/organizations/new/")({
  component: OrganizationsNewPage,
});
