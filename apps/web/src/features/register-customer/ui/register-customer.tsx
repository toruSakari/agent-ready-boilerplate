"use client";
import { t as translate } from "@dev-template/client/i18n";
import { ActionForm, ACCESS_FORM_LIMITS } from "@dev-template/client/manage-access";
import { useRegisterCustomer } from "#web/features/register-customer/api/use-register-customer.ts";

export function RegisterCustomer() {
  const registration = useRegisterCustomer();
  return (
    <ActionForm
      label={translate("会員登録する")}
      fields={[
        {
          name: "name",
          label: translate("表示名"),
          maxLength: ACCESS_FORM_LIMITS.nameMaxLength,
        },
      ]}
      onSubmit={async (values) => {
        await registration.mutateAsync({ name: values.name ?? "" });
      }}
    />
  );
}
