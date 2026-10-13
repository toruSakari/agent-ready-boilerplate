import { Link } from "@tanstack/react-router";
import { t as translate } from "@dev-template/client/i18n";
import { useOrganizationId } from "@dev-template/client/api";
import { Card } from "@dev-template/ui/card";
import { Button } from "@dev-template/ui/button";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";

export function BusinessSettings() {
  const organizationId = useOrganizationId();
  return (
    <BusinessShell
      title={translate("設定")}
      description={translate("現在の企業と、ご自身のサービス登録情報を確認します。")}
    >
      <Card className="max-w-3xl p-6">
        <h2 className="text-lg font-semibold">{translate("現在の企業")}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{translate("企業ID")}</p>
        <p className="mt-1 font-mono">{organizationId}</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/">{translate("企業を切り替える")}</Link>
        </Button>
      </Card>
      <Card className="max-w-3xl p-6">
        <h2 className="text-lg font-semibold">{translate("アカウント")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {translate("サービスへの登録状況の確認と退会手続きを行えます。")}
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/account">{translate("登録情報・退会")}</Link>
        </Button>
      </Card>
    </BusinessShell>
  );
}
