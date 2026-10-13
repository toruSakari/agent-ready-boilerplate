import { useState } from "react";
import { Button } from "@dev-template/ui/button";
import type { StockOperation } from "#business/entities/inventory/index.ts";
import { t } from "@dev-template/client/i18n";
import { usePermissions } from "@dev-template/client/entities/access";
import { useStock } from "#business/entities/inventory/index.ts";
import { Card } from "@dev-template/ui/card";
import { StockForm } from "#business/features/manage-stock/ui/stock-form.tsx";

export function StockEditor(props: { id: string }) {
  const stock = useStock(props.id);
  const [operation, setOperation] = useState<StockOperation>("receive");
  const { can } = usePermissions();
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{t("在庫管理")}</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt>{t("在庫数")}</dt>
          <dd className="mt-1 break-all text-xl font-semibold tabular-nums">{stock.onHand}</dd>
        </div>
        <div>
          <dt>{t("予約中")}</dt>
          <dd className="mt-1 break-all text-xl font-semibold tabular-nums">{stock.reserved}</dd>
        </div>
        <div>
          <dt>{t("購入可能")}</dt>
          <dd className="mt-1 break-all text-xl font-semibold tabular-nums">{stock.available}</dd>
        </div>
      </dl>
      {can("product.update") && (
        <div>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={t("在庫操作")}>
            <Button
              className="w-fit"
              variant={operation === "receive" ? "default" : "outline"}
              aria-pressed={operation === "receive"}
              onClick={() => setOperation("receive")}
            >
              {t("入荷")}
            </Button>
            <Button
              className="w-fit"
              variant={operation === "recount" ? "default" : "outline"}
              aria-pressed={operation === "recount"}
              onClick={() => setOperation("recount")}
            >
              {t("棚卸し・訂正")}
            </Button>
          </div>
          <StockForm
            key={`${props.id}:${stock.onHand}:${operation}`}
            id={props.id}
            onHand={stock.onHand}
            operation={operation}
          />
        </div>
      )}
    </Card>
  );
}
