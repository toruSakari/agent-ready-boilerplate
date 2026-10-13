import { useCreateProductForm } from "#business/features/create-product/model/use-create-product-form.ts";
import { ProductNameField, ProductPriceField } from "#business/entities/product/index.ts";
import { t as translate, errorMessage } from "@dev-template/client/i18n";
import { CATALOG_INPUT_LIMITS } from "@dev-template/client/config";

import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";
import { Input } from "@dev-template/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@dev-template/ui/form";

export function CreateProductForm(props: { onCreated?: (id: string) => Promise<void> } = {}) {
  const { form, create, pending, submit } = useCreateProductForm(props.onCreated);
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{translate("商品を登録")}</h2>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(submit)}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <fieldset disabled={pending} className="contents">
            <FormField
              control={form.control}
              name="sku"
              render={(inputProps) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input
                      {...inputProps.field}
                      required
                      maxLength={CATALOG_INPUT_LIMITS.skuMaxLength}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ProductNameField required />
            <ProductPriceField label={translate("価格（円）")} required />
            <FormField
              control={form.control}
              name="initialStock"
              render={(inputProps) => (
                <FormItem>
                  <FormLabel>{translate("初期在庫（個）")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={Number.MAX_SAFE_INTEGER}
                      step={1}
                      required
                      {...inputProps.field}
                      value={Number.isNaN(inputProps.field.value) ? "" : inputProps.field.value}
                      onChange={(event) => inputProps.field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
          <Button disabled={pending} type="submit">
            {pending ? translate("登録中…") : translate("商品を登録")}
          </Button>
        </form>
      </Form>
      {create.error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{errorMessage(create.error)}</AlertDescription>
        </Alert>
      ) : null}
    </Card>
  );
}
