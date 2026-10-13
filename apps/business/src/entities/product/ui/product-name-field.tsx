import { useFormContext } from "react-hook-form";
import { t as translate } from "@dev-template/client/i18n";
import { CATALOG_INPUT_LIMITS } from "@dev-template/client/config";
import { Input } from "@dev-template/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@dev-template/ui/form";

/** 商品登録・更新の入力契約を共有し、操作固有の送信状態は親フォームが所有する。 */
export function ProductNameField(props: { required?: boolean }) {
  const { required = false } = props;

  const { control } = useFormContext<{ name: string; unitPrice: number }>();
  return (
    <FormField
      control={control}
      name="name"
      render={(inputProps) => (
        <FormItem>
          <FormLabel>{translate("商品名")}</FormLabel>
          <FormControl>
            <Input
              {...inputProps.field}
              required={required}
              maxLength={CATALOG_INPUT_LIMITS.nameMaxLength}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
