import { t as translate } from "#client/shared/i18n";
import { CATALOG_INPUT_LIMITS, ORDER_INPUT_LIMITS } from "#client/shared/config/input-limits";
import { Button } from "@dev-template/ui/button";
import type { useOrderEditor } from "#client/features/manage-order/model/use-order-editor";

export function OrderEditToolbar(props: { editor: ReturnType<typeof useOrderEditor> }) {
  const { pending, fields, append, setEditing } = props.editor;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending || fields.length >= ORDER_INPUT_LIMITS.lineCountMax}
        onClick={() =>
          append({
            sku: "",
            name: "",
            quantity: ORDER_INPUT_LIMITS.quantityMin,
            unitPrice: CATALOG_INPUT_LIMITS.unitPriceMin,
          })
        }
      >
        {translate("明細を追加")}
      </Button>
      <Button disabled={pending} type="submit">
        {translate("変更を保存")}
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(false)}>
        {translate("編集を閉じる")}
      </Button>
    </div>
  );
}
