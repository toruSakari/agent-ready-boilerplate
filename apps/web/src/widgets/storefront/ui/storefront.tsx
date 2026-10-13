import { StorefrontHero } from "#web/widgets/storefront/ui/storefront-hero.tsx";
import { useState } from "react";
import { t } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { ProductCard, useStoreProducts } from "#web/entities/store-product/index.ts";

export function Storefront(props: {
  search?: string;
  filters?: Omit<
    import("@dev-template/api-types").RouterInputs["store"]["list"],
    "limit" | "cursor" | "search"
  >;
}) {
  const { search = "", filters = {} } = props;

  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | undefined>();
  const { data } = useStoreProducts(search, cursor, filters);
  const products = data.items;
  return (
    <>
      <StorefrontHero />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-highlight">
            {t("商品を探す")}
          </p>
          <h2 className="text-2xl font-bold">
            {search ? t("「{{search}}」の検索結果", { search }) : t("すべての商品")}
          </h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {t("このページの商品：{{count}}件", { count: products.length })}
        </span>
      </div>
      {products.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">{t("商品が見つかりませんでした")}</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("検索条件を変えて、もう一度お試しください。")}
          </p>
        </div>
      )}
      <div className="mt-8 flex justify-center gap-4">
        <Button variant="outline" disabled={!cursor} onClick={() => setCursor(undefined)}>
          {t("最初のページへ")}
        </Button>
        <Button
          variant="outline"
          disabled={!data.nextCursor}
          onClick={() => setCursor(data.nextCursor ?? undefined)}
        >
          {t("次の商品を見る")}
        </Button>
      </div>
    </>
  );
}
