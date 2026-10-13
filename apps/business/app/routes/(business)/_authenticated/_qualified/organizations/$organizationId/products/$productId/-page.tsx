import { Route } from "#app/routes/(business)/_authenticated/_qualified/organizations/$organizationId/products/$productId/route.ts";
import { BusinessProductDetail } from "#business/widgets/business-workspace/index.ts";

export function DetailPage() {
  const { productId } = Route.useParams();
  return <BusinessProductDetail id={productId} />;
}
