import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { CustomerOrders } from "#web/widgets/customer-orders/index.ts";

export function OrdersPage() {
  return (
    <DataErrorBoundary>
      <CustomerOrders />
    </DataErrorBoundary>
  );
}
