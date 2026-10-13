import { t as translate } from "@dev-template/client/i18n";
import { PRODUCT_IMAGE_LIMITS } from "#business/entities/product/index.ts";
import type { ImageChange } from "#business/features/manage-product-image/model/image-change.ts";
import { Label } from "@dev-template/ui/label";
import { Input } from "@dev-template/ui/input";

/** ファイル入力をリセットして、同じファイルでも失敗後に再選択できるようにする。 */
type UploadProps = {
  id: string;
  name: string;
  append?: boolean;
  imageKey?: string | null;
  pending: boolean;
  error: boolean;
  errorId: string;
  onChange: (action: ImageChange) => Promise<void>;
};

export function ProductImageUpload(props: UploadProps) {
  const { id, name, append = false, imageKey, pending, error, errorId, onChange } = props;

  let label;
  if (append) {
    label = translate("画像を追加（複数選択可）");
  } else {
    if (imageKey) {
      label = translate("画像を差し替え");
    } else {
      label = translate("商品画像をアップロード");
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {label}
      </Label>
      <Input
        id={id}
        type="file"
        multiple={append}
        accept={PRODUCT_IMAGE_LIMITS.mimeTypes.join(",")}
        disabled={pending}
        aria-label={
          append
            ? translate("{{name}}の画像を追加", { name })
            : translate("{{name}}の画像", { name })
        }
        aria-invalid={error}
        aria-describedby={error ? errorId : undefined}
        className="h-auto py-2"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (!files.length) {
            return;
          }

          if (append) {
            void onChange({ kind: "append", files });
          } else {
            void onChange({ kind: "replace", file: files[0]! });
          }
        }}
      />
    </div>
  );
}
