import { Link } from "@tanstack/react-router";
import { t } from "@dev-template/client/i18n";

export function StoreFooter() {
  return (
    <footer className="mt-12 bg-hero px-5 py-10 text-center text-sm text-hero-muted">
      <p className="text-lg font-bold text-hero-foreground">market.</p>
      <p className="mt-3">{t("商品との新しい出会いを、毎日に。")}</p>
      <div className="mt-5 flex justify-center gap-6">
        <Link to="/account">{t("アカウント")}</Link>
        <Link to="/orders">{t("注文履歴")}</Link>
      </div>
    </footer>
  );
}
