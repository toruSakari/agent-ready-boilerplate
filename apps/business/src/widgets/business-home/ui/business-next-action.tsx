import { Link } from "@tanstack/react-router";
import { t as translate } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";
import { Button } from "@dev-template/ui/button";

export function BusinessNextAction(props: { draftCount: number; organizationId: string }) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="text-lg font-semibold">{translate("次の作業")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {props.draftCount > 0
              ? translate("{{count}}件の下書きがあります。内容を確認して確定してください。", {
                  count: props.draftCount,
                })
              : translate("未確定の下書きはありません。注文一覧から販売状況を確認できます。")}
          </p>
        </div>
        <Button asChild>
          <Link
            to="/organizations/$organizationId/orders"
            params={{ organizationId: props.organizationId }}
          >
            {translate("注文を確認")}
          </Link>
        </Button>
      </div>
    </Card>
  );
}
