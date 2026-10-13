import { useUpdateProductForm } from "#business/features/update-product/model/use-update-product-form.ts";
import { ProductNameField, ProductPriceField } from "#business/entities/product/index.ts";
import type { Product } from "#business/entities/product/index.ts";
import { t as translate, errorMessage } from "@dev-template/client/i18n";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";
import { Form } from "@dev-template/ui/form";

export function UpdateProductForm(props: { product: Product }) {
  const { form, update, pending, submit } = useUpdateProductForm(props.product);
  return (
    <Card className="p-6">
      <h2 className="mb-5 text-lg font-semibold">{translate("商品情報を編集")}</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            <ProductNameField />
            <ProductPriceField label={translate("販売価格")} />
            <Button type="submit">
              {pending ? translate("保存中…") : translate("変更を保存")}
            </Button>
          </fieldset>
          {update.error && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(update.error)}</AlertDescription>
            </Alert>
          )}
          {update.isSuccess && (
            <p role="status" className="text-sm text-success">
              {translate("商品情報を保存しました。")}
            </p>
          )}
        </form>
      </Form>
    </Card>
  );
}
