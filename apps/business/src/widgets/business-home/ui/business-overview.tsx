import { BusinessNextAction } from "#business/widgets/business-home/ui/business-next-action.tsx";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC, useOrganizationId, perQueryAccessOptions } from "@dev-template/client/api";
import { t as translate } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";

export function BusinessOverview() {
  const trpc = useTRPC();
  const organizationId = useOrganizationId();
  const query = useSuspenseQuery(
    trpc.dashboard.summary.queryOptions(undefined, perQueryAccessOptions),
  );
  if (query.error) {
    throw query.error;
  }

  const summary = query.data;
  const metrics = [
    { title: translate("注文総数"), value: summary.ordersTotal },
    { title: translate("下書きの注文"), value: summary.draftCount },
    { title: translate("確定した注文"), value: summary.confirmedCount },
    { title: translate("登録商品"), value: summary.productsTotal },
    { title: translate("企業メンバー"), value: summary.membersTotal },
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics
          .filter((metric) => metric.value !== null)
          .map((metric) => (
            <Card key={metric.title} className="p-6">
              <p className="text-sm text-muted-foreground">{metric.title}</p>
              <p className="mt-4 text-4xl font-bold tracking-tight">{metric.value}</p>
              <p className="mt-3 text-xs text-muted-foreground">{translate("現在の企業・全件")}</p>
            </Card>
          ))}
      </div>
      {summary.draftCount !== null && organizationId && (
        <BusinessNextAction draftCount={summary.draftCount} organizationId={organizationId} />
      )}
    </>
  );
}
