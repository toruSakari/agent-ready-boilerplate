import { Route } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/orders/$orderId/route.ts";
import { BusinessOrderDetail } from "#business/widgets/business-workspace/index.ts";

export function DetailPage() {
  const { orderId } = Route.useParams();
  return <BusinessOrderDetail id={orderId} />;
}
