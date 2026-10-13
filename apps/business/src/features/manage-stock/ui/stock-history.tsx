import { t, formatDateTime } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";
import { stockHistoryLabels, useStockHistory } from "#business/entities/inventory/index.ts";
import { ListPagination } from "#business/shared/ui/list-pagination.tsx";

export function StockHistory(props: { id: string }) {
  const history = useStockHistory(props.id);
  return (
    <Card className="overflow-hidden">
      <section aria-label={t("入荷・棚卸しの履歴")}>
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">{t("入荷・棚卸しの履歴")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("注文の確定・取消による在庫変動は注文履歴で確認してください")}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                {["日時", "操作", "変更前 → 変更後", "変更理由", "担当者"].map((label) => (
                  <th key={label} className="whitespace-nowrap p-4">
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.data.map((entry) => {
                const labels = stockHistoryLabels(entry);
                return (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap p-4">{formatDateTime(entry.createdAt)}</td>
                    <td className="whitespace-nowrap p-4">{labels.operation}</td>
                    <td className="whitespace-nowrap p-4 tabular-nums">
                      {t("{{before}} → {{after}}", {
                        before: entry.beforeStock,
                        after: entry.afterStock,
                      })}
                    </td>
                    <td className="p-4">{labels.reason}</td>
                    <td className="p-4">{labels.actor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {history.data.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("在庫操作の履歴はまだありません")}</p>
        )}
        <ListPagination
          label={t("在庫履歴のページ切替")}
          page={history.page}
          fetching={history.isFetching}
          hasNextPage={history.hasNextPage}
          previousPage={history.previousPage}
          nextPage={history.nextPage}
        />
      </section>
    </Card>
  );
}
