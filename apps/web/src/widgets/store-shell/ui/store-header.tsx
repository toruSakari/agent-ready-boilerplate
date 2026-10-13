import { StoreSearch } from "#web/widgets/store-shell/ui/store-search.tsx";
import { Link } from "@tanstack/react-router";
import { t, formatMoney } from "@dev-template/client/i18n";
import { LanguageMenu } from "@dev-template/client/language";
import { useCart, cartTotal } from "#web/entities/cart/index.ts";

export function StoreHeader() {
  const cart = useCart();
  return (
    <header className="bg-hero text-hero-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-5 px-5 py-5">
        <Link to="/" className="text-2xl font-black tracking-tight">
          market<span className="text-hero-accent">.</span>
        </Link>
        <StoreSearch />
        <nav className="ml-auto flex items-center gap-5 text-sm">
          <Link to="/orders" className="font-semibold">
            {t("注文履歴")}
          </Link>
          <Link to="/cart" className="font-semibold">
            {t("カート")}{" "}
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
              {cart.reduce((sum, line) => sum + line.quantity, 0)}
            </span>
          </Link>
          <Link to="/account" className="font-semibold">
            {t("会員情報")}
          </Link>
          <LanguageMenu />
        </nav>
      </div>
      <div className="border-t border-hero-border bg-hero-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 text-xs text-hero-muted">
          <Link to="/">{t("すべての商品")}</Link>
          <span>{t("カート合計：{{amount}}", { amount: formatMoney(cartTotal(cart)) })}</span>
        </div>
      </div>
    </header>
  );
}
