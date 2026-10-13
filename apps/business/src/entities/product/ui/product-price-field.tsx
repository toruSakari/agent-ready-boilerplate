import { useFormContext } from "react-hook-form";
import { CATALOG_INPUT_LIMITS, INTEGER_INPUT_STEP } from "@dev-template/client/config";
import { Input } from "@dev-template/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@dev-template/ui/form";

export function ProductPriceField(props: { label: string; required?: boolean }) {
  const { label, required = false } = props;

  const { control } = useFormContext<{ name: string; unitPrice: number }>();
  return (
    <FormField
      control={control}
      name="unitPrice"
      render={(inputProps) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...inputProps.field}
              type="number"
              required={required}
              min={CATALOG_INPUT_LIMITS.unitPriceMin}
              max={CATALOG_INPUT_LIMITS.unitPriceMax}
              step={INTEGER_INPUT_STEP}
              value={Number.isNaN(inputProps.field.value) ? "" : inputProps.field.value}
              onChange={(event) => inputProps.field.onChange(event.target.valueAsNumber)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
