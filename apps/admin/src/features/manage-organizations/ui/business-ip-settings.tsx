"use client";
import { t as translate } from "@dev-template/client/i18n";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { BusinessIpPolicyEditor } from "#admin/features/manage-organizations/ui/business-ip-policy-editor.tsx";

export function BusinessIpSettings(props: { id: string }) {
  return (
    <DataErrorBoundary key={props.id} loadingLabel={translate("IP制限を確認しています…")}>
      <BusinessIpPolicyEditor id={props.id} />
    </DataErrorBoundary>
  );
}
