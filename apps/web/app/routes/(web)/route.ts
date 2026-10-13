import { createFileRoute } from "@tanstack/react-router";
import { StorePage } from "#app/routes/(web)/-page.tsx";
import { storeListSearchSchema } from "@dev-template/client/list-filters";

export const Route = createFileRoute("/(web)/")({
  validateSearch: storeListSearchSchema,
  component: StorePage,
});
