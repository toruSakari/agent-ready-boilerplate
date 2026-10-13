"use client";
import { useId } from "react";
import { t as translate } from "@dev-template/client/i18n";
import { ProductImage, productImages } from "#business/entities/product/index.ts";
import { useImageEditor } from "#business/features/manage-product-image/model/use-image-editor.ts";
import type { ProductImageEditorProps } from "#business/features/manage-product-image/model/editor-props.ts";
import { ProductImageUpload } from "#business/features/manage-product-image/ui/product-image-upload.tsx";
import { AdditionalProductImages } from "#business/features/manage-product-image/ui/additional-product-images.tsx";
import { Button } from "@dev-template/ui/button";
import { Alert, AlertDescription } from "@dev-template/ui/alert";

export function ProductImageEditor(props: ProductImageEditorProps) {
  const id = useId();
  const { error, pending, changeImage } = useImageEditor(props);
  const { primaryImage, additionalImages } = productImages(props.images, props.imageKey);
  const product = { id: props.productId, imageKey: props.imageKey, name: props.name };
  const upload = {
    name: props.name,
    pending,
    error: !!error,
    errorId: `${id}-error`,
    onChange: changeImage,
  };
  return (
    <div className="mt-4 space-y-3">
      <ProductImage product={product} />
      {props.imageKey && <p className="text-sm text-muted-foreground">{translate("メイン画像")}</p>}
      <ProductImageUpload {...upload} id={id} imageKey={props.imageKey} />
      {primaryImage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => void changeImage({ kind: "remove", imageId: primaryImage.id })}
        >
          {translate("画像を削除")}
        </Button>
      )}
      {!!additionalImages.length && (
        <AdditionalProductImages
          product={product}
          images={additionalImages}
          pending={pending}
          onChange={changeImage}
        />
      )}
      <ProductImageUpload {...upload} id={`${id}-additional`} append />
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {translate("画像を更新中…")}
        </p>
      )}
      {error && (
        <Alert variant="destructive" id={`${id}-error`}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
