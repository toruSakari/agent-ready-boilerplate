import { t as translate } from "@dev-template/client/i18n";
import { ProductImage } from "#business/entities/product/index.ts";
import type { ProductImageEntry, Product } from "#business/entities/product/index.ts";
import { Button } from "@dev-template/ui/button";
import type { ImageChange } from "#business/features/manage-product-image/model/image-change.ts";

export function AdditionalProductImage(props: {
  product: Pick<Product, "id" | "name" | "imageKey">;
  image: ProductImageEntry;
  number: number;
  pending: boolean;
  onChange: (action: ImageChange) => Promise<void>;
}) {
  return (
    <li className="space-y-2">
      <ProductImage
        product={props.product}
        image={props.image}
        alt={translate("{{name}}の商品画像 {{number}}", {
          name: props.product.name,
          number: props.number,
        })}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={props.pending}
        aria-label={translate("{{name}}の画像{{number}}を削除", {
          name: props.product.name,
          number: props.number,
        })}
        onClick={() => void props.onChange({ kind: "remove", imageId: props.image.id })}
      >
        {translate("この画像を削除")}
      </Button>
    </li>
  );
}
