import { t as translate } from "@dev-template/client/i18n";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";
import { BusinessOverview } from "#business/widgets/business-home/ui/business-overview.tsx";

export function BusinessHome() {
  return (
    <BusinessShell
      title={translate("ダッシュボード")}
      description={translate(
        "企業の注文・商品・メンバーの状況を確認し、今日の業務を始めましょう。",
      )}
    >
      <DataErrorBoundary loadingLabel={translate("企業の状況を読み込み中…")}>
        <BusinessOverview />
      </DataErrorBoundary>
    </BusinessShell>
  );
}
