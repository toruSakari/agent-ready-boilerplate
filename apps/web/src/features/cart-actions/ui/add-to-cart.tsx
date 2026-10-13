import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { t } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Input } from "@dev-template/ui/input";
import { Label } from "@dev-template/ui/label";
import { addToCart, CART_QUANTITY_LIMIT } from "#web/entities/cart/index.ts";
import type { StoreProduct } from "#web/entities/store-product/index.ts";

export function AddToCart(props: { product: StoreProduct }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const maximum = Math.min(CART_QUANTITY_LIMIT, props.product.availableQuantity);
  return (
    <div className="space-y-4">
      <Label htmlFor="product-quantity">{t("数量")}</Label>
      <Input
        id="product-quantity"
        type="number"
        min={1}
        max={maximum}
        value={quantity}
        onChange={(event) => {
          setAdded(false);
          setQuantity(Number(event.target.value));
        }}
      />
      <Button
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={maximum < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > maximum}
        onClick={() => {
          addToCart(
            {
              tenantId: props.product.tenantId,
              sku: props.product.sku,
              name: props.product.name,
              unitPrice: props.product.unitPrice,
            },
            quantity,
          );
          setAdded(true);
        }}
      >
        {t("カートに入れる")}
      </Button>
      {added && (
        <div role="status" className="rounded-lg bg-success/10 p-4 text-sm text-success">
          {t("カートに追加しました")}
          <Link to="/cart" className="mt-2 block font-semibold underline">
            {t("カートを確認する")}
          </Link>
        </div>
      )}
    </div>
  );
}
