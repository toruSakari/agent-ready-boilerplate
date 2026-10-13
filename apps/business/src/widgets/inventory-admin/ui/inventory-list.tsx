import { hasListFilters, inventoryListSearchSchema } from "@dev-template/client/list-filters";
import { Link } from "@tanstack/react-router";
import { t } from "@dev-template/client/i18n";
import { useOrganizationId } from "@dev-template/client/api";
import { useInventoryList } from "#business/entities/inventory/index.ts";
import { ListPagination } from "#business/shared/ui/list-pagination.tsx";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";

export function InventoryList(props: {
  filters?: Omit<import("zod").infer<typeof inventoryListSearchSchema>, "q"> & { search?: string };
}) {
  const { filters = {} } = props;

  const inventory = useInventoryList(filters);
  const organizationId = useOrganizationId();
  if (!organizationId) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <section aria-label={t("商品別の在庫")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                {["商品名", "SKU", "在庫数", "予約中", "購入可能", "操作"].map((label) => (
                  <th key={label} className="whitespace-nowrap p-4">
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {inventory.data.map((product) => (
                <tr key={product.id} className="hover:bg-muted/30">
                  <td className="min-w-40 p-4 font-medium">{product.name}</td>
                  <td className="p-4 font-mono text-muted-foreground">{product.sku}</td>
                  <td className="p-4 tabular-nums">{product.onHand}</td>
                  <td className="p-4 tabular-nums">{product.reserved}</td>
                  <td className="p-4 font-semibold tabular-nums">{product.available}</td>
                  <td className="p-4">
                    <Button asChild variant="outline" size="sm" className="w-fit whitespace-nowrap">
                      <Link
                        to="/organizations/$organizationId/products/$productId"
                        params={{ organizationId, productId: product.id }}
                      >
                        {t("在庫管理")}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {inventory.data.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">
            {t(
              hasListFilters(filters)
                ? "該当する結果はありません。検索条件を変更してください。"
                : "商品はまだありません。",
            )}
          </p>
        )}
        <ListPagination
          label={t("在庫一覧のページ切替")}
          page={inventory.page}
          fetching={inventory.isFetching}
          hasNextPage={inventory.hasNextPage}
          previousPage={inventory.previousPage}
          nextPage={inventory.nextPage}
        />
      </section>
    </Card>
  );
}
