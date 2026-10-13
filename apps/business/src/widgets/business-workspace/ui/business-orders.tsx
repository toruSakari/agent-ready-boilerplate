import {
  ListFilters,
  useListSearch,
  orderListSearchSchema,
  orderFilterOptions,
} from "@dev-template/client/list-filters";
import { t as translate } from "@dev-template/client/i18n";
import { PermissionGate } from "@dev-template/client/entities/access";
import { DataErrorBoundary, TableSkeleton } from "@dev-template/client/error-boundary";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";
import { BusinessOrderList } from "#business/widgets/business-orders/index.ts";

export function BusinessOrders() {
  const search = useListSearch(orderListSearchSchema);
  const { q, ...filters } = search.value;
  return (
    <BusinessShell
      title={translate("注文管理")}
      description={translate("注文の状態と金額を確認し、詳細画面から必要な操作を行います。")}
    >
      <PermissionGate required={["order:read"]}>
        <ListFilters
          key={search.key}
          value={search.value}
          onChange={search.change}
          searchLabel={translate("注文番号を検索")}
          options={orderFilterOptions}
          statusKey="status"
          dates
        />
        <DataErrorBoundary
          loadingFallback={
            <TableSkeleton columns={["注文", "状態", "合計", "詳細"].map(translate)} />
          }
          resetKey={search.key}
        >
          <BusinessOrderList key={search.key} filters={{ ...filters, search: q }} />
        </DataErrorBoundary>
      </PermissionGate>
    </BusinessShell>
  );
}
