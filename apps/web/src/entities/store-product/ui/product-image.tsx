import { t } from "@dev-template/client/i18n";
import { useProductImage } from "#web/entities/store-product/api/product.ts";

export function ProductImage(props: {
  tenantId: string;
  sku: string;
  imageId?: string;
  name: string;
  className?: string;
}) {
  const { tenantId, sku, imageId, name, className = "" } = props;

  const image = useProductImage(tenantId, sku, imageId);
  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-gradient-to-br from-muted to-accent ${className}`}
    >
      {image.data ? (
        <img
          className="h-full w-full object-contain p-5"
          src={`data:${image.data.contentType};base64,${image.data.base64}`}
          alt={name}
        />
      ) : (
        <div className="text-center text-muted-foreground">
          <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            className="mx-auto h-20 w-20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 21 32 9l22 12v25L32 58 10 46Z" />
            <path d="m10 21 22 12 22-12M32 33v25M21 15l22 12" />
          </svg>
          <span className="mt-3 block text-xs">{t("商品画像準備中")}</span>
        </div>
      )}
    </div>
  );
}
