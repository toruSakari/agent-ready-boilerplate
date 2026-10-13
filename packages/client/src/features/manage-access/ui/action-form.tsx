"use client";
import { t as translate } from "#client/shared/i18n";
import type { AccessField } from "#client/features/manage-access/model/action-form";
import { useActionForm } from "#client/features/manage-access/model/use-action-form";
import { ActionFormField } from "#client/features/manage-access/ui/action-form-field";
import { Form } from "@dev-template/ui/form";
import { Button } from "@dev-template/ui/button";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
export type { AccessField } from "#client/features/manage-access/model/action-form";

export function ActionForm(props: {
  fields: AccessField[];
  label: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const { form, hydrated, error, success, submit } = useActionForm(props.fields, props.onSubmit);
  return (
    <Form {...form}>
      <form noValidate className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
        <fieldset disabled={!hydrated || form.formState.isSubmitting} className="grid gap-3">
          {props.fields.map((f) => (
            <ActionFormField key={f.name} definition={f} />
          ))}
          <Button type="submit">
            {form.formState.isSubmitting ? translate("処理中…") : props.label}
          </Button>
        </fieldset>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && <p role="status">{translate("処理が完了しました")}</p>}
      </form>
    </Form>
  );
}
