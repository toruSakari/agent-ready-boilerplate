import { Link } from "@tanstack/react-router";
import { t, formatMoney } from "@dev-template/client/i18n";
import { Badge } from "@dev-template/ui/badge";

import type { StoreProduct } from "#web/entities/store-product/model/product.ts";
import { productAvailability } from "#web/entities/store-product/model/product.ts";
import { ProductImage } from "#web/entities/store-product/ui/product-image.tsx";

export function ProductCard(props: { product: StoreProduct }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        to="/products/$organizationId/$sku"
        params={{ organizationId: props.product.tenantId, sku: props.product.sku }}
      >
        <ProductImage
          tenantId={props.product.tenantId}
          sku={props.product.sku}
          imageId={props.product.images[0]?.id}
          name={props.product.name}
          className="aspect-square"
        />
        <div className="p-5">
          <p className="text-xs text-muted-foreground">{props.product.organizationName}</p>
          <h2 className="mt-2 line-clamp-2 min-h-12 text-base font-semibold group-hover:text-highlight">
            {props.product.name}
          </h2>
          <p className="mt-4 text-2xl font-bold">{formatMoney(props.product.unitPrice)}</p>
          <Badge variant="secondary" className="mt-3">
            {productAvailability(props.product) ? t("在庫あり") : t("在庫なし")}
          </Badge>
          <span className="mt-4 flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
            {t("商品を見る")}
          </span>
        </div>
      </Link>
    </article>
  );
}
