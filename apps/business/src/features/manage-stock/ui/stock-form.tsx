import { NativeSelect } from "@dev-template/ui/native-select";
import { stockReasons, stockReasonLabels } from "#business/entities/inventory/index.ts";
import type { StockOperation } from "#business/entities/inventory/index.ts";
import { t, errorMessage } from "@dev-template/client/i18n";
import { useStockForm } from "#business/features/manage-stock/model/use-stock-form.ts";
import { Button } from "@dev-template/ui/button";
import { Input } from "@dev-template/ui/input";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@dev-template/ui/form";

export function StockForm(props: { id: string; onHand: number; operation?: StockOperation }) {
  const { id, onHand, operation = "recount" } = props;

  const { form, change, submit, refresh, pending } = useStockForm(id, onHand, operation);
  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(submit)} className="mt-4 space-y-4">
        <FormField
          control={form.control}
          name="quantity"
          render={(inputProps) => (
            <FormItem>
              <FormLabel>
                {t(operation === "receive" ? "入荷数（個）" : "棚卸し後の在庫数（個）")}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={operation === "receive" ? 1 : 0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  disabled={pending}
                  {...inputProps.field}
                  value={Number.isNaN(inputProps.field.value) ? "" : inputProps.field.value}
                  onChange={(event) => inputProps.field.onChange(event.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reason"
          render={(inputProps) => (
            <FormItem>
              <FormLabel>{t("変更理由")}</FormLabel>
              <FormControl>
                <NativeSelect {...inputProps.field} disabled={pending}>
                  {stockReasons[operation].map((reason) => (
                    <option key={reason} value={reason}>
                      {t(stockReasonLabels[reason])}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-sm text-muted-foreground">
          {t(
            operation === "receive"
              ? "受け入れた数量を現在の在庫に加算します"
              : "確認した実数へ変更します。予約中の数量より少なくできません",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="w-fit" type="submit" disabled={pending}>
            {pending ? t("保存中…") : t(operation === "receive" ? "入荷を登録" : "棚卸しを反映")}
          </Button>
          <Button
            className="w-fit"
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void refresh()}
          >
            {t("最新の在庫を確認")}
          </Button>
        </div>
        {change.error && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(change.error)}</AlertDescription>
          </Alert>
        )}
      </form>
    </Form>
  );
}
