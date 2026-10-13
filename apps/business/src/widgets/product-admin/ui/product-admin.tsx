import { ListFilters, useListSearch, listSearchSchema } from "@dev-template/client/list-filters";
import { t as translate } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import { usePermissions } from "@dev-template/client/entities/access";
import { useOrganizationId } from "@dev-template/client/api";
import { Button } from "@dev-template/ui/button";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";
import { ProductList } from "#business/widgets/product-admin/ui/product-list.tsx";
import { DataErrorBoundary, TableSkeleton } from "@dev-template/client/error-boundary";

export function ProductAdmin() {
  const search = useListSearch(listSearchSchema);
  const { q, ...filters } = search.value;
  const organizationId = useOrganizationId();
  const { can } = usePermissions();
  return (
    <BusinessShell
      title={translate("商品管理")}
      description={translate(
        "販売する商品の一覧です。登録・価格変更・画像管理は専用の画面で行います。",
      )}
      actions={
        organizationId &&
        can("product.update") && (
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/organizations/$organizationId/products/new" params={{ organizationId }}>
              {translate("商品を登録")}
            </Link>
          </Button>
        )
      }
    >
      <ListFilters
        key={search.key}
        value={search.value}
        onChange={search.change}
        searchLabel={translate("商品名・SKUを検索")}
      />
      <DataErrorBoundary
        loadingFallback={
          <TableSkeleton
            label={translate("商品を読み込み中…")}
            columns={["商品名", "SKU", "販売価格", "画像", "詳細"].map(translate)}
          />
        }
        resetKey={search.key}
        loadingLabel={translate("商品を読み込み中…")}
      >
        <ProductList key={search.key} filters={{ ...filters, search: q }} />
      </DataErrorBoundary>
    </BusinessShell>
  );
}
