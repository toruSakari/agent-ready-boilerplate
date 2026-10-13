import { hasListFilters, listSearchSchema } from "@dev-template/client/list-filters";
import { ProductRow } from "#business/widgets/product-admin/ui/product-row.tsx";
import { ListPagination } from "#business/shared/ui/list-pagination.tsx";
import { t as translate } from "@dev-template/client/i18n";
import { useOrganizationId } from "@dev-template/client/api";
import { Card } from "@dev-template/ui/card";
import { useProducts } from "#business/entities/product/index.ts";

export function ProductList(props: {
  filters?: Omit<import("zod").infer<typeof listSearchSchema>, "q"> & { search?: string };
}) {
  const { filters = {} } = props;

  const products = useProducts(filters);
  const organizationId = useOrganizationId();
  if (products.data === null || !organizationId) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <section aria-label={translate("商品一覧")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="p-4">{translate("商品名")}</th>
                <th className="p-4">SKU</th>
                <th className="p-4">{translate("販売価格")}</th>
                <th className="p-4">{translate("画像")}</th>
                <th className="p-4">{translate("詳細")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.data.map((product) => (
                <ProductRow key={product.id} product={product} organizationId={organizationId} />
              ))}
            </tbody>
          </table>
        </div>
        {products.data.length === 0 && (
          <p className="p-12 text-center text-muted-foreground">
            {translate(
              hasListFilters(filters)
                ? "該当する結果はありません。検索条件を変更してください。"
                : "商品はまだありません。",
            )}
          </p>
        )}
        <ListPagination
          label={translate("商品のページ切替")}
          page={products.page}
          fetching={products.isFetching}
          hasNextPage={!!products.hasNextPage}
          previousPage={products.previousPage}
          nextPage={products.nextPage}
        />
      </section>
    </Card>
  );
}
