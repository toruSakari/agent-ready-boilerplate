import { t, formatMoney } from "@dev-template/client/i18n";
import type { CartLine } from "#web/entities/cart/index.ts";

export function CheckoutLineSummary(props: { line: CartLine }) {
  return (
    <div className="flex justify-between gap-5 py-4">
      <div>
        <p className="font-medium">{props.line.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("数量：{{quantity}}", { quantity: props.line.quantity })}
        </p>
      </div>
      <p className="font-semibold">{formatMoney(props.line.unitPrice * props.line.quantity)}</p>
    </div>
  );
}
