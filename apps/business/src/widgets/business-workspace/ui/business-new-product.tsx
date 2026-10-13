import { useNavigate } from "@tanstack/react-router";
import { useOrganizationId } from "@dev-template/client/api";
import { t as translate } from "@dev-template/client/i18n";
import { PermissionGate } from "@dev-template/client/entities/access";
import { CreateProductForm } from "#business/features/create-product/index.ts";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";

export function BusinessNewProduct() {
  const navigate = useNavigate();
  const organizationId = useOrganizationId();
  async function onCreated(id: string) {
    if (organizationId) {
      await navigate({
        to: "/organizations/$organizationId/products/$productId",
        params: { organizationId, productId: id },
      });
    }
  }
  return (
    <BusinessShell
      title={translate("商品登録")}
      description={translate(
        "商品名・SKU・販売価格を登録します。画像は登録後の商品編集から追加できます。",
      )}
    >
      <PermissionGate required={["product.update"]}>
        <div className="max-w-4xl">
          <CreateProductForm onCreated={onCreated} />
        </div>
      </PermissionGate>
    </BusinessShell>
  );
}
