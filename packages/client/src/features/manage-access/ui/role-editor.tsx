"use client";
import { t as translate } from "#client/shared/i18n";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@dev-template/ui/form";
import { Input } from "@dev-template/ui/input";
import { Button } from "@dev-template/ui/button";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { ACCESS_FORM_LIMITS } from "#client/features/manage-access/model/form-policy";
import type { RoleEditorValues } from "#client/features/manage-access/model/role-editor";
import { useRoleEditor } from "#client/features/manage-access/model/use-role-editor";
import { RolePermissionSelector } from "#client/features/manage-access/ui/role-permission-selector";

/**
 * catalogはAPIが返す現在追加可能な権限、permissionLabelsは保存済み権限の表示名として使う。
 * プラン外になった既存権限も保持・削除は可能にし、カタログへ戻るまで追加はさせない。
 */
export function RoleEditor(props: {
  catalog: Record<string, string>;
  permissionLabels?: Record<string, string>;
  initial?: RoleEditorValues;
  onSubmit: (input: RoleEditorValues) => Promise<void>;
}) {
  const { catalog, permissionLabels = catalog, initial, onSubmit } = props;

  const {
    form,
    options: permissionOptions,
    error,
    success,
    submit,
  } = useRoleEditor({ catalog, permissionLabels, initial, onSubmit });
  return (
    <Form {...form}>
      <form noValidate className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
        <fieldset disabled={form.formState.isSubmitting} className="grid gap-3">
          <FormField
            control={form.control}
            name="name"
            render={(inputProps) => (
              <FormItem>
                <FormLabel>{translate("ロール名")}</FormLabel>
                <FormControl>
                  <Input
                    {...inputProps.field}
                    required
                    maxLength={ACCESS_FORM_LIMITS.nameMaxLength}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <RolePermissionSelector options={permissionOptions} />
          <Button type="submit">
            {form.formState.isSubmitting ? translate("保存中…") : translate("ロールを保存")}
          </Button>
        </fieldset>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && <p role="status">{translate("ロールを保存しました")}</p>}
      </form>
    </Form>
  );
}
