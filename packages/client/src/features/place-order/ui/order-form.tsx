"use client";
import { t as translate } from "#client/shared/i18n";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderCreationSchema } from "#client/features/place-order/model/order-form";
import { LINE_FIELD_NAMES } from "#client/features/place-order/model/line-fields";
import { OrderCreationLineField } from "#client/features/place-order/ui/line-field";
import { OrderDraftField } from "#client/features/place-order/ui/order-draft-field";
import { DEFAULT_ORDER_LINE } from "#client/features/place-order/model/form-defaults";
import type { OrderLine } from "#client/entities/order";
import { Button } from "@dev-template/ui/button";
import { Form } from "@dev-template/ui/form";

// 作成と下書き編集の制約を同じ注文スキーマに合わせる。送信先での検証も別途必要。

export function OrderForm(props: {
  isPending: boolean;
  onSubmit: (lines: OrderLine[], draft?: boolean) => Promise<void>;
}) {
  const form = useForm({
    resolver: zodResolver(orderCreationSchema),
    defaultValues: { lines: [DEFAULT_ORDER_LINE], draft: false },
  });
  const draft = useWatch({ control: form.control, name: "draft" });
  // Mutationの待機とフォームの非同期送信の両方を扱い、送信中の編集・再送信を抑える。
  // 数値の空欄はvalueAsNumberのNaNを検証し、表示では空文字に戻す。
  const pending = props.isPending || form.formState.isSubmitting;
  let submitLabel;
  if (pending) {
    submitLabel = translate("保存しています…");
  } else {
    if (draft) {
      submitLabel = translate("下書きを保存");
    } else {
      submitLabel = translate("注文する");
    }
  }

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit((data) => props.onSubmit(data.lines, data.draft))}
      >
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          {LINE_FIELD_NAMES.map((name) => (
            <OrderCreationLineField key={name} index={0} name={name} />
          ))}
        </fieldset>
        <OrderDraftField pending={pending} />
        <Button className="w-full sm:w-auto" disabled={pending} type="submit">
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}
