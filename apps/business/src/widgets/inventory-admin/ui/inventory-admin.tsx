import {
  ListFilters,
  useListSearch,
  inventoryListSearchSchema,
  stockFilterOptions,
} from "@dev-template/client/list-filters";
import { t } from "@dev-template/client/i18n";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { InventoryList } from "#business/widgets/inventory-admin/ui/inventory-list.tsx";
import { InventoryListSkeleton } from "#business/widgets/inventory-admin/ui/inventory-list-skeleton.tsx";

export function InventoryAdmin() {
  const search = useListSearch(inventoryListSearchSchema);
  const { q, ...filters } = search.value;
  return (
    <BusinessShell
      title={t("在庫一覧")}
      description={t(
        "商品ごとの現在庫・予約中・購入可能数を確認できます。入荷と棚卸しは各商品の在庫管理で行います。",
      )}
    >
      <ListFilters
        key={search.key}
        value={search.value}
        onChange={search.change}
        searchLabel={t("商品名・SKUを検索")}
        options={stockFilterOptions}
        statusKey="stock"
      />
      <p className="mb-4 text-sm text-muted-foreground">
        {t("在庫状態は予約を差し引く前の在庫数で判定します。")}
      </p>
      <DataErrorBoundary resetKey={search.key} loadingFallback={<InventoryListSkeleton />}>
        <InventoryList key={search.key} filters={{ ...filters, search: q }} />
      </DataErrorBoundary>
    </BusinessShell>
  );
}
