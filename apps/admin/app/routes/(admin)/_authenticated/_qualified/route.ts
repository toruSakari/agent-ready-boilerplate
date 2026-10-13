import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#app/routes/(admin)/_authenticated/_qualified/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified/")({
  component: HomePage,
});
