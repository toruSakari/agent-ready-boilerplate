import { createFileRoute } from "@tanstack/react-router";
import { AccessPage } from "#app/routes/(admin)/_authenticated/_qualified/access/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified/access/")({
  component: AccessPage,
});
