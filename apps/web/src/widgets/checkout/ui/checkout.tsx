import { Link } from "@tanstack/react-router";
import { t } from "@dev-template/client/i18n";
import { useCart } from "#web/entities/cart/index.ts";
import { CheckoutGroup } from "#web/features/checkout/index.ts";

export function Checkout() {
  const cart = useCart();
  const tenants = [...new Set(cart.map((line) => line.tenantId))];
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/cart" className="text-sm text-muted-foreground">
        {t("カートに戻る")}
      </Link>
      <h1 className="mb-3 mt-6 text-3xl font-bold">{t("購入内容の確認")}</h1>
      <p className="mb-7 text-sm leading-6 text-muted-foreground">
        {t("商品・数量・金額を確認して注文を確定してください。販売元ごとに注文が作成されます。")}
      </p>
      <div className="space-y-6">
        {tenants.map((tenantId) => (
          <CheckoutGroup
            key={tenantId}
            tenantId={tenantId}
            lines={cart.filter((line) => line.tenantId === tenantId)}
          />
        ))}
      </div>
      {!tenants.length && (
        <p>
          {t("カートは空です")}{" "}
          <Link to="/" className="text-highlight underline">
            {t("商品を探す")}
          </Link>
        </p>
      )}
    </div>
  );
}
