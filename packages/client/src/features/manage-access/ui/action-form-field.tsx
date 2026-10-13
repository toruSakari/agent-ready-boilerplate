import { useFormContext } from "react-hook-form";
import { t as translate } from "#client/shared/i18n";
import type { AccessField } from "#client/features/manage-access/model/action-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@dev-template/ui/form";
import { Input } from "@dev-template/ui/input";
import { NativeSelect, NativeSelectOption } from "@dev-template/ui/native-select";

export function ActionFormField(props: { definition: AccessField }) {
  const form = useFormContext<Record<string, string>>();
  return (
    <FormField
      control={form.control}
      name={props.definition.name}
      render={(inputProps) => (
        <FormItem>
          <FormLabel>{props.definition.label}</FormLabel>
          <FormControl>
            {props.definition.options ? (
              <NativeSelect {...inputProps.field}>
                <NativeSelectOption value="">{translate("選択してください")}</NativeSelectOption>
                {props.definition.options.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <Input
                {...inputProps.field}
                type={props.definition.type ?? "text"}
                required
                maxLength={props.definition.maxLength}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
