import { t as translate } from "@dev-template/client/i18n";
import { PermissionGate } from "@dev-template/client/entities/access";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";
import { BusinessOrderContent } from "#business/widgets/business-workspace/ui/business-order-content.tsx";

export function BusinessOrderDetail(props: { id: string }) {
  return (
    <BusinessShell
      title={translate("注文詳細")}
      description={translate("注文の明細と状態を確認し、許可された操作を行います。")}
    >
      <PermissionGate required={["order:read"]}>
        <DataErrorBoundary>
          <BusinessOrderContent id={props.id} />
        </DataErrorBoundary>
      </PermissionGate>
    </BusinessShell>
  );
}
