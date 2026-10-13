import { CheckoutLineSummary } from "#web/features/checkout/ui/checkout-line-summary.tsx";
import { useCheckout } from "#web/features/checkout/api/checkout.ts";
import { t, formatMoney, errorMessage } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { cartTotal } from "#web/entities/cart/index.ts";
import type { CartLine } from "#web/entities/cart/index.ts";

export function CheckoutGroup(props: { tenantId: string; lines: CartLine[] }) {
  const checkout = useCheckout(props.tenantId);
  const error = checkout.error ? errorMessage(checkout.error) : null;
  return (
    <Card className="p-6 md:p-8">
      <h2 className="text-lg font-semibold">{t("注文内容")}</h2>
      <div className="mt-5 divide-y">
        {props.lines.map((line) => (
          <CheckoutLineSummary key={line.sku} line={line} />
        ))}
      </div>
      <div className="mt-4 flex justify-between border-t pt-5 text-lg font-bold">
        <span>{t("注文合計")}</span>
        <span>{formatMoney(cartTotal(props.lines))}</span>
      </div>
      <p className="my-5 rounded-lg bg-primary/10 p-4 text-sm leading-6 text-highlight">
        {t("この環境はデモ注文です。実際の請求や配送は行われません。")}
      </p>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={checkout.isPending}
        onClick={() => {
          checkout.reset();
          checkout.mutate({
            tenantId: props.tenantId,
            lines: props.lines.map((inputProps) => ({
              sku: inputProps.sku,
              name: inputProps.name,
              quantity: inputProps.quantity,
              unitPrice: inputProps.unitPrice,
            })),
          });
        }}
      >
        {checkout.isPending ? t("注文を確定しています…") : t("注文を確定する")}
      </Button>
    </Card>
  );
}
