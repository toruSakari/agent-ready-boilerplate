"use client";
import { t as translate } from "@dev-template/client/i18n";
import { BUSINESS_IP_FORM_MAX_ENTRIES } from "#admin/features/manage-organizations/model/business-ip-form.ts";
import { useBusinessIpForm } from "#admin/features/manage-organizations/model/use-business-ip-form.ts";
import { BusinessIpFields } from "#admin/features/manage-organizations/ui/business-ip-fields.tsx";
import { Form } from "@dev-template/ui/form";
import { Button } from "@dev-template/ui/button";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import type { RouterOutputs } from "@dev-template/api-types";

export function BusinessIpPolicyForm(props: {
  id: string;
  policy: RouterOutputs["access"]["businessIpPolicy"];
}) {
  const { form, submit, pending, error, saved } = useBusinessIpForm(props.id, props.policy);
  return (
    <Form {...form}>
      <form className="grid gap-3" onSubmit={submit}>
        <fieldset className="grid gap-3" disabled={pending}>
          <BusinessIpFields />
          <p className="text-sm text-muted-foreground">
            {translate(
              "最大{{max}}件。許可範囲外の企業担当者は利用できなくなります。管理画面から解除できます。",
              { max: BUSINESS_IP_FORM_MAX_ENTRIES },
            )}
          </p>
          <Button type="submit">
            {pending ? translate("保存中…") : translate("IP制限を保存")}
          </Button>
        </fieldset>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {saved && <p role="status">{translate("IP制限を保存しました")}</p>}
      </form>
    </Form>
  );
}
