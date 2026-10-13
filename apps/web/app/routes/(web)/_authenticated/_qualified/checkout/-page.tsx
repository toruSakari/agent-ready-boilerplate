import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { Checkout } from "#web/widgets/checkout/index.ts";

export function CheckoutPage() {
  return (
    <DataErrorBoundary>
      <Checkout />
    </DataErrorBoundary>
  );
}
