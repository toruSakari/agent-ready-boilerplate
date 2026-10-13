import { PermissionDeniedPage } from "@dev-template/client/access";
import { PermissionGate } from "@dev-template/client/entities/access";
import { BusinessNavigation } from "#business/widgets/business-navigation/index.ts";
import { InventoryAdmin } from "#business/widgets/inventory-admin/index.ts";

export function InventoryPage() {
  return (
    <PermissionGate
      required={["product.read"]}
      fallback={<PermissionDeniedPage navigation={<BusinessNavigation />} />}
    >
      <InventoryAdmin />
    </PermissionGate>
  );
}
