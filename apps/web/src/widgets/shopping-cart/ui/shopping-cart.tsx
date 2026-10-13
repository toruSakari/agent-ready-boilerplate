import { CartLineItem } from "#web/features/cart-actions/index.ts";
import { Link } from "@tanstack/react-router";
import { t, formatMoney } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";
import { useCart, cartTotal } from "#web/entities/cart/index.ts";

export function ShoppingCart() {
  const cart = useCart();
  return (
    <>
      <h1 className="mb-8 text-3xl font-bold">{t("ショッピングカート")}</h1>
      {cart.length ? (
        <div className="grid items-start gap-7 lg:grid-cols-[1fr_320px]">
          <Card className="divide-y">
            {cart.map((line) => (
              <CartLineItem key={`${line.tenantId}/${line.sku}`} line={line} />
            ))}
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">{t("小計")}</p>
            <p className="mt-2 text-3xl font-bold">{formatMoney(cartTotal(cart))}</p>
            <Button
              asChild
              className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link to="/checkout">{t("購入手続きへ")}</Link>
            </Button>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {t("販売元ごとに注文を確定します。")}
            </p>
          </Card>
        </div>
      ) : (
        <Card className="px-6 py-20 text-center">
          <h2 className="text-xl font-semibold">{t("カートは空です")}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("気になる商品をカートに追加して、お買い物を始めましょう。")}
          </p>
          <Button asChild className="mt-6">
            <Link to="/">{t("商品を探す")}</Link>
          </Button>
        </Card>
      )}
    </>
  );
}
