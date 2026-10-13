import { t as translate } from "#client/shared/i18n";
import { useFormContext } from "react-hook-form";
import type { OrderCreationValues } from "#client/features/place-order/model/order-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@dev-template/ui/form";
import { Checkbox } from "@dev-template/ui/checkbox";

export function OrderDraftField(props: { pending: boolean }) {
  const form = useFormContext<OrderCreationValues>();
  return (
    <FormField
      control={form.control}
      name="draft"
      render={(inputProps) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormControl>
            <Checkbox
              name={inputProps.field.name}
              ref={inputProps.field.ref}
              onBlur={inputProps.field.onBlur}
              checked={inputProps.field.value}
              onCheckedChange={(checked) => inputProps.field.onChange(checked === true)}
              disabled={props.pending}
            />
          </FormControl>
          <FormLabel>{translate("下書きとして保存")}</FormLabel>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
