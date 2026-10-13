import { ActionForm } from "@dev-template/client/manage-access";
import { t } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";
import {
  useCustomerPlans,
  useChangeCustomerPlan,
} from "#web/features/change-plan/api/use-customer-plan.ts";
import {
  customerPlanFields,
  NO_CUSTOMER_PLAN,
} from "#web/features/change-plan/model/plan-fields.ts";

export function CustomerPlan() {
  const plans = useCustomerPlans();
  const mutation = useChangeCustomerPlan();
  return (
    <Card className="grid gap-4 p-6">
      <h2 className="text-xl font-semibold">{t("利用プラン")}</h2>
      <p className="text-sm text-muted-foreground">{t("ご自身の利用プランを変更できます。")}</p>
      <ActionForm
        key={plans.currentCode ?? NO_CUSTOMER_PLAN}
        label={t("プランを変更")}
        fields={customerPlanFields(plans)}
        onSubmit={async (values) => {
          await mutation.mutateAsync({
            planCode: values.planCode === NO_CUSTOMER_PLAN ? null : (values.planCode ?? null),
          });
        }}
      />
    </Card>
  );
}
