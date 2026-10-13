import { t } from "@dev-template/client/i18n";
import {
  ListFilters,
  useListSearch,
  orderListSearchSchema,
  orderFilterOptions,
} from "@dev-template/client/list-filters";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { CustomerOrderList } from "#web/widgets/customer-orders/ui/customer-order-list.tsx";

export function CustomerOrders() {
  const search = useListSearch(orderListSearchSchema);
  const { q, ...filters } = search.value;
  return (
    <>
      <h1 className="mb-3 text-3xl font-bold">{t("注文履歴")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {t("これまでのお買い物と注文状況を確認できます。")}
      </p>
      <ListFilters
        key={search.key}
        value={search.value}
        onChange={search.change}
        searchLabel={t("注文番号を検索")}
        options={orderFilterOptions}
        dates
      />
      <DataErrorBoundary resetKey={search.key}>
        <CustomerOrderList key={search.key} filters={{ ...filters, search: q }} />
      </DataErrorBoundary>
    </>
  );
}
