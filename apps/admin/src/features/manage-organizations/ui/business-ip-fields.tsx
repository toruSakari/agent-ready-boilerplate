import { useFormContext } from "react-hook-form";
import { t as translate } from "@dev-template/client/i18n";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@dev-template/ui/form";
import { Checkbox } from "@dev-template/ui/checkbox";

export function BusinessIpFields() {
  const form = useFormContext<{ enabled: boolean; allowedIps: string }>();
  return (
    <>
      <FormField
        control={form.control}
        name="enabled"
        render={(props) => (
          <FormItem>
            <div className="flex items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={props.field.value}
                  onCheckedChange={(v) => props.field.onChange(v === true)}
                />
              </FormControl>
              <FormLabel>{translate("企業画面のIP制限を有効にする")}</FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="allowedIps"
        render={(props) => (
          <FormItem>
            <FormLabel>{translate("許可IP・CIDR（1行に1件）")}</FormLabel>
            <FormControl>
              <textarea
                {...props.field}
                rows={4}
                className="w-full rounded-md border border-input bg-background p-3 text-foreground"
                placeholder={"203.0.113.10\n198.51.100.0/24\n2001:db8::/32"}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
