import { hasListFilters, orderListSearchSchema } from "@dev-template/client/list-filters";
import { BusinessOrderRow } from "#business/widgets/business-orders/ui/business-order-row.tsx";
import { ListPagination } from "#business/shared/ui/list-pagination.tsx";
import { useOrders } from "@dev-template/client/entities/order";
import { useOrganizationId } from "@dev-template/client/api";
import { t as translate } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";

export function BusinessOrderList(props: {
  filters?: Omit<import("zod").infer<typeof orderListSearchSchema>, "q"> & { search?: string };
}) {
  const { filters = {} } = props;

  const orders = useOrders(filters);
  const organizationId = useOrganizationId();
  if (orders.data === null || !organizationId) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="p-4">{translate("注文")}</th>
              <th className="p-4">{translate("状態")}</th>
              <th className="p-4">{translate("合計")}</th>
              <th className="p-4">{translate("詳細")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.data.map((order) => (
              <BusinessOrderRow key={order.id} order={order} organizationId={organizationId} />
            ))}
          </tbody>
        </table>
      </div>
      {orders.data.length === 0 && (
        <p className="p-12 text-center text-muted-foreground">
          {translate(
            hasListFilters(filters)
              ? "該当する結果はありません。検索条件を変更してください。"
              : "注文はまだありません。",
          )}
        </p>
      )}
      <ListPagination
        label={translate("注文のページ切替")}
        page={orders.page}
        fetching={orders.isFetching}
        hasNextPage={!!orders.hasNextPage}
        previousPage={orders.previousPage}
        nextPage={orders.nextPage}
      />
    </Card>
  );
}
