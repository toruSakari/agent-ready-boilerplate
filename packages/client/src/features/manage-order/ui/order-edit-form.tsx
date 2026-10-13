import { t as translate } from "#client/shared/i18n";
import { ORDER_INPUT_LIMITS } from "#client/shared/config/input-limits";
import { Button } from "@dev-template/ui/button";
import type { useOrderEditor } from "#client/features/manage-order/model/use-order-editor";
import { Form } from "@dev-template/ui/form";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { LINE_FIELD_NAMES } from "#client/features/manage-order/model/line-fields";
import { OrderEditLineField } from "#client/features/manage-order/ui/line-field";
import { OrderEditToolbar } from "#client/features/manage-order/ui/order-edit-toolbar";

export function OrderEditForm(props: { editor: ReturnType<typeof useOrderEditor> }) {
  const { form, fields, pending, save, remove } = props.editor;
  const { errors } = form.formState;
  return (
    <Form {...form}>
      <form className="grid gap-3" noValidate onSubmit={form.handleSubmit(save)}>
        {fields.map((field, index) => (
          <fieldset
            disabled={pending}
            key={field.id}
            className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2"
          >
            <legend>
              {translate("明細")}
              {index + 1}
            </legend>
            {LINE_FIELD_NAMES.map((name) => (
              <OrderEditLineField key={name} index={index} name={name} />
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={pending || fields.length <= ORDER_INPUT_LIMITS.lineCountMin}
              onClick={() => remove(index)}
            >
              {translate("明細を削除")}
            </Button>
          </fieldset>
        ))}
        {errors.lines?.root?.message || errors.lines?.message ? (
          <Alert variant="destructive">
            <AlertDescription>
              {errors.lines?.root?.message ?? errors.lines?.message}
            </AlertDescription>
          </Alert>
        ) : null}
        <OrderEditToolbar editor={props.editor} />
      </form>
    </Form>
  );
}
