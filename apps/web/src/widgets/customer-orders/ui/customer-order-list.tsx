import { hasListFilters } from "@dev-template/client/list-filters";
import { CustomerOrderCard, useCustomerOrders } from "#web/entities/customer-order/index.ts";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { t } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";

export function CustomerOrderList(props: {
  filters: Omit<
    import("@dev-template/api-types").RouterInputs["store"]["listOrders"],
    "limit" | "cursor"
  >;
}) {
  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | undefined>();
  const { data } = useCustomerOrders(cursor, props.filters);
  return (
    <>
      <div className="space-y-5">
        {data.items.map((order) => (
          <CustomerOrderCard key={order.id} order={order} />
        ))}
      </div>
      {!data.items.length && (
        <Card className="p-16 text-center">
          <h2 className="text-xl font-semibold">
            {t(
              hasListFilters(props.filters)
                ? "該当する結果はありません。検索条件を変更してください。"
                : "まだ注文はありません",
            )}
          </h2>
          <Button asChild className="mt-6">
            <Link to="/">{t("商品を探す")}</Link>
          </Button>
        </Card>
      )}
      <div className="mt-8 flex justify-center gap-4">
        <Button variant="outline" disabled={!cursor} onClick={() => setCursor(undefined)}>
          {t("最初のページへ")}
        </Button>
        <Button
          variant="outline"
          disabled={!data.nextCursor}
          onClick={() => setCursor(data.nextCursor ?? undefined)}
        >
          {t("次へ")}
        </Button>
      </div>
    </>
  );
}
