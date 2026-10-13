import {
  organizationPathParams,
  organizationIdPathSchema,
} from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/orders/$orderId/-page.tsx";

export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/orders/$orderId/",
)({
  params: {
    parse: (params) => ({
      ...organizationPathParams.parse(params),
      orderId: organizationIdPathSchema.parse(params.orderId),
    }),
  },
  component: DetailPage,
});
