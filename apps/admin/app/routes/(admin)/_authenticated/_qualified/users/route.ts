import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "#app/routes/(admin)/_authenticated/_qualified/users/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified/users/")({
  component: UsersPage,
});
