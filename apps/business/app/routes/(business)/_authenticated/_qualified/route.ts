import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#app/routes/(business)/_authenticated/_qualified/-page.tsx";

export const Route = createFileRoute("/(business)/_authenticated/_qualified/")({
  component: HomePage,
});
