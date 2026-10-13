import {
  organizationPathParams,
  organizationIdPathSchema,
} from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/products/$productId/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/products/$productId/",
)({
  params: {
    parse: (params) => ({
      ...organizationPathParams.parse(params),
      productId: organizationIdPathSchema.parse(params.productId),
    }),
  },
  component: DetailPage,
});
