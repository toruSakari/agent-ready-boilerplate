import { Link } from "@tanstack/react-router";
import { t, formatMoney } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";
import { useStoreProduct, ProductImage } from "#web/entities/store-product/index.ts";
import { AddToCart } from "#web/features/cart-actions/index.ts";

export function ProductDetail(props: { tenantId: string; sku: string }) {
  const { data: product } = useStoreProduct(props.tenantId, props.sku);
  return (
    <>
      <Link to="/" className="text-sm text-muted-foreground hover:text-highlight">
        {t("商品一覧に戻る")}
      </Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_1fr_320px]">
        <ProductImage
          tenantId={props.tenantId}
          sku={props.sku}
          imageId={product.images[0]?.id}
          name={product.name}
          className="aspect-square rounded-2xl border"
        />
        <div>
          <p className="text-sm text-highlight">{product.organizationName}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">{product.name}</h1>
          <div className="my-6 border-t" />
          <p className="text-3xl font-bold">{formatMoney(product.unitPrice)}</p>
          <dl className="mt-8 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("販売元")}</dt>
              <dd className="mt-1 font-medium">{product.organizationName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("商品コード")}</dt>
              <dd className="mt-1">{product.sku}</dd>
            </div>
          </dl>
        </div>
        <Card className="h-fit p-6">
          <p className="text-2xl font-bold">{formatMoney(product.unitPrice)}</p>
          <p
            className={`mb-6 mt-4 text-sm font-semibold ${product.availableQuantity ? "text-success" : "text-muted-foreground"}`}
          >
            {product.availableQuantity ? t("在庫あり") : t("在庫なし")}
          </p>
          <AddToCart product={product} />
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            {t("在庫表示は目安です。購入時に最新の在庫を確認します。")}
          </p>
        </Card>
      </div>
    </>
  );
}
