import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { ProductDetail } from "#web/widgets/product-detail/index.ts";
import { Route } from "#app/routes/(web)/products/$organizationId/$sku/route.ts";

export function ProductPage() {
  const params = Route.useParams();
  return (
    <DataErrorBoundary>
      <ProductDetail tenantId={params.organizationId} sku={params.sku} />
    </DataErrorBoundary>
  );
}
