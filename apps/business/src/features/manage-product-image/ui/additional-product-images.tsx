import { t as translate } from "@dev-template/client/i18n";
import type { Product, ProductImageEntry } from "#business/entities/product/index.ts";
import { AdditionalProductImage } from "#business/features/manage-product-image/ui/additional-product-image.tsx";
import type { ImageChange } from "#business/features/manage-product-image/model/image-change.ts";

type Props = {
  product: Pick<Product, "id" | "name" | "imageKey">;
  images: readonly ProductImageEntry[];
  pending: boolean;
  onChange: (action: ImageChange) => Promise<void>;
};

export function AdditionalProductImages(props: Props) {
  return (
    <ul
      aria-label={translate("{{name}}の追加画像", { name: props.product.name })}
      className="grid gap-3 sm:grid-cols-2"
    >
      {props.images.map((image, index) => (
        <AdditionalProductImage
          key={image.id}
          product={props.product}
          image={image}
          number={index + 2}
          pending={props.pending}
          onChange={props.onChange}
        />
      ))}
    </ul>
  );
}
