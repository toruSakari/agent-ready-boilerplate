import { Link } from "@tanstack/react-router";
import { t, formatMoney } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Input } from "@dev-template/ui/input";
import { removeCartLine, setCartQuantity, CART_QUANTITY_LIMIT } from "#web/entities/cart/index.ts";
import type { CartLine } from "#web/entities/cart/index.ts";

export function CartLineItem(props: { line: CartLine }) {
  return (
    <article className="flex flex-wrap items-center gap-5 p-6">
      <div className="flex-1">
        <Link
          to="/products/$organizationId/$sku"
          params={{ organizationId: props.line.tenantId, sku: props.line.sku }}
          className="text-lg font-semibold hover:text-highlight"
        >
          {props.line.name}
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">{formatMoney(props.line.unitPrice)}</p>
        <Button
          variant="ghost"
          className="mt-2 px-0 text-sm text-muted-foreground"
          onClick={() => removeCartLine(props.line.tenantId, props.line.sku)}
        >
          {t("削除")}
        </Button>
      </div>
      <Input
        className="w-20"
        aria-label={t("{{name}}の数量", { name: props.line.name })}
        type="number"
        min={1}
        max={CART_QUANTITY_LIMIT}
        value={props.line.quantity}
        onChange={(event) => {
          const quantity = Number(event.target.value);
          if (Number.isInteger(quantity) && quantity >= 1 && quantity <= CART_QUANTITY_LIMIT) {
            setCartQuantity(props.line.tenantId, props.line.sku, quantity);
          }
        }}
      />
      <p className="w-28 text-right text-lg font-semibold">
        {formatMoney(props.line.unitPrice * props.line.quantity)}
      </p>
    </article>
  );
}
