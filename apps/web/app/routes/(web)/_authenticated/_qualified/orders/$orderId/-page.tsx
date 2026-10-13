import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { CustomerOrderDetail } from "#web/widgets/customer-orders/index.ts";
import { Route } from "#app/routes/(web)/_authenticated/_qualified/orders/$orderId/route.ts";

export function OrderPage() {
  const params = Route.useParams();
  return (
    <DataErrorBoundary>
      <CustomerOrderDetail id={params.orderId} />
    </DataErrorBoundary>
  );
}
