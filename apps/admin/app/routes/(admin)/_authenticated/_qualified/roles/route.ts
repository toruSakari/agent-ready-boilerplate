import { createFileRoute } from "@tanstack/react-router";
import { RolesPage } from "#app/routes/(admin)/_authenticated/_qualified/roles/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified/roles/")({
  component: RolesPage,
});
