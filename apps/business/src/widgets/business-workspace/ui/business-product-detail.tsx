import { t as translate } from "@dev-template/client/i18n";
import { PermissionGate } from "@dev-template/client/entities/access";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";
import { BusinessProductContent } from "#business/widgets/business-workspace/ui/business-product-content.tsx";

export function BusinessProductDetail(props: { id: string }) {
  return (
    <BusinessShell
      title={translate("商品詳細")}
      description={translate("商品情報と画像を確認・編集します。SKUは登録後に変更できません。")}
    >
      <PermissionGate required={["product.read"]}>
        <DataErrorBoundary>
          <BusinessProductContent id={props.id} />
        </DataErrorBoundary>
      </PermissionGate>
    </BusinessShell>
  );
}
