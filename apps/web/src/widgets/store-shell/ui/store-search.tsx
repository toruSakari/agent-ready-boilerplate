import { t } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Input } from "@dev-template/ui/input";
import { STORE_PATH_LIMITS } from "#web/shared/config/store-route-params.ts";

export function StoreSearch() {
  return (
    <form
      action="/"
      method="get"
      className="order-last flex w-full overflow-hidden rounded-lg md:order-none md:w-auto md:flex-1"
    >
      <Input
        name="q"
        maxLength={STORE_PATH_LIMITS.searchMaxLength}
        aria-label={t("商品を検索")}
        placeholder={t("気になる商品を探す")}
        className="h-11 rounded-none border-0 bg-card text-foreground"
      />
      <Button
        type="submit"
        className="h-11 rounded-none bg-primary px-6 text-primary-foreground hover:bg-primary/90"
      >
        {t("検索")}
      </Button>
    </form>
  );
}
