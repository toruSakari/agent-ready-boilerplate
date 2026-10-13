import { t } from "#client/shared/i18n";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@dev-template/ui/form";
import { Input } from "@dev-template/ui/input";
import type { OrderEditValues } from "#client/features/manage-order/model/order-form";
import { lineFieldConfig } from "#client/features/manage-order/model/line-fields";
import type { LineFieldName } from "#client/features/manage-order/model/line-fields";

export function OrderEditLineField(props: { name: LineFieldName; index: number }) {
  const form = useFormContext<OrderEditValues>();
  const { label, numeric, ...attributes } = lineFieldConfig(props.name);
  return (
    <FormField
      control={form.control}
      name={`lines.${props.index}.${props.name}`}
      render={(inputProps) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...inputProps.field}
              {...attributes}
              required
              type={numeric ? "number" : "text"}
              value={Number.isNaN(inputProps.field.value) ? "" : inputProps.field.value}
              onChange={(event) =>
                inputProps.field.onChange(numeric ? event.target.valueAsNumber : event.target.value)
              }
              aria-label={props.name === "unitPrice" ? t("単価") : undefined}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
