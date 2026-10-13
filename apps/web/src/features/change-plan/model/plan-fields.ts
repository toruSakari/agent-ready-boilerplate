import type { RouterOutputs } from "@dev-template/api-types";
import { t } from "@dev-template/client/i18n";

export const NO_CUSTOMER_PLAN = "__no_customer_plan__";

export function customerPlanFields(data: RouterOutputs["access"]["customerPlans"]) {
  return [
    {
      name: "planCode",
      label: t("利用プラン"),
      initial: data.currentCode ?? NO_CUSTOMER_PLAN,
      options: [
        { value: NO_CUSTOMER_PLAN, label: t("プランを利用しない") },
        ...data.plans.map((plan) => ({ value: plan.code, label: t(plan.name) })),
      ],
    },
  ];
}
