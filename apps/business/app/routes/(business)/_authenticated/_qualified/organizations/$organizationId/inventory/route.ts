import { inventoryListSearchSchema } from "@dev-template/client/list-filters";
import { createFileRoute } from "@tanstack/react-router";
import { organizationPathParams } from "@dev-template/client/route-params";
import { InventoryPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/inventory/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/inventory/",
)({
  params: organizationPathParams,
  validateSearch: inventoryListSearchSchema,
  component: InventoryPage,
});
