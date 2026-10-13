import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { ShoppingCart } from "#web/widgets/shopping-cart/index.ts";

export function CartPage() {
  return (
    <DataErrorBoundary>
      <ShoppingCart />
    </DataErrorBoundary>
  );
}
