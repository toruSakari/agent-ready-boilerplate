import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import {
  ListFilters,
  stockFilterOptions,
  storeListSearchSchema,
} from "@dev-template/client/list-filters";
import { t } from "@dev-template/client/i18n";
import { Storefront } from "#web/widgets/storefront/index.ts";
import { Route } from "#app/routes/(web)/route.ts";

export function StorePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { q, ...filters } = search;
  const key = JSON.stringify(search);
  return (
    <>
      <ListFilters
        key={key}
        value={search}
        onChange={(next) => {
          void navigate({ search: () => storeListSearchSchema.parse(next) });
        }}
        searchLabel={t("商品名・SKUを検索")}
        options={stockFilterOptions}
        statusKey="stock"
        prices
      />
      <DataErrorBoundary resetKey={key}>
        <Storefront search={q} filters={filters} key={key} />
      </DataErrorBoundary>
    </>
  );
}
