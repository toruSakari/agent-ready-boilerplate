import { t as translate, formatMoney } from "@dev-template/client/i18n";
import { usePermissions } from "@dev-template/client/entities/access";
import { Card } from "@dev-template/ui/card";
import {
  ProductImage,
  useProductDetail,
  useRefreshProducts,
} from "#business/entities/product/index.ts";
import { UpdateProductForm } from "#business/features/update-product/index.ts";
import { ProductImageEditor } from "#business/features/manage-product-image/index.ts";
import {
  StockEditor,
  StockSkeleton,
  StockHistory,
  StockHistorySkeleton,
} from "#business/features/manage-stock/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function BusinessProductContent(props: { id: string }) {
  const product = useProductDetail(props.id);
  const { can } = usePermissions();
  const refresh = useRefreshProducts();
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <Card className="p-6">
          <ProductImage product={product} />
          <h2 className="mt-5 text-xl font-semibold">{product.name}</h2>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{product.sku}</p>
          <p className="mt-3 text-2xl font-bold">{formatMoney(product.unitPrice)}</p>
        </Card>
        {can("product.update") && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">{translate("商品画像")}</h2>
            <ProductImageEditor
              productId={product.id}
              imageKey={product.imageKey}
              images={product.images}
              name={product.name}
              onChanged={refresh}
            />
          </Card>
        )}
      </div>
      <div className="min-w-0 space-y-6">
        <DataErrorBoundary loadingFallback={<StockSkeleton editable={can("product.update")} />}>
          <StockEditor id={props.id} />
        </DataErrorBoundary>
        {can("product.update") && (
          <UpdateProductForm
            key={`${product.id}:${product.name}:${product.unitPrice}`}
            product={product}
          />
        )}
      </div>
      <div className="min-w-0 xl:col-span-2">
        <DataErrorBoundary loadingFallback={<StockHistorySkeleton />}>
          <StockHistory id={props.id} />
        </DataErrorBoundary>
      </div>
    </div>
  );
}
