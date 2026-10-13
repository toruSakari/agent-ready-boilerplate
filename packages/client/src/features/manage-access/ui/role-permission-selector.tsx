import { useFormContext } from "react-hook-form";
import { t as translate } from "#client/shared/i18n";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@dev-template/ui/form";
import { Checkbox } from "@dev-template/ui/checkbox";
import type {
  rolePermissionOptions,
  RoleEditorValues,
} from "#client/features/manage-access/model/role-editor";

export function RolePermissionSelector(props: {
  options: ReturnType<typeof rolePermissionOptions>;
}) {
  const form = useFormContext<RoleEditorValues>();
  return (
    <FormField
      control={form.control}
      name="permissions"
      render={(inputProps) => (
        <FormItem>
          <FormLabel>{translate("許可する操作")}</FormLabel>
          <div className="grid gap-2">
            {props.options.map((inputProps2) => (
              <FormItem key={inputProps2.code} className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={inputProps2.checked}
                    disabled={inputProps2.disabled}
                    onCheckedChange={(nextChecked) =>
                      inputProps.field.onChange(
                        nextChecked
                          ? [...inputProps.field.value, inputProps2.code]
                          : inputProps.field.value.filter((value) => value !== inputProps2.code),
                      )
                    }
                  />
                </FormControl>
                <FormLabel>{inputProps2.label}</FormLabel>
              </FormItem>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
