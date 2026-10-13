import { t as translate } from "@dev-template/client/i18n";
import { usePlans, useAssignPlan } from "#admin/features/manage-plans/api/use-plans.ts";
import { ActionForm } from "@dev-template/client/manage-access";
import {
  UNASSIGNED_PLAN_OPTION,
  planAssignmentFields,
} from "#admin/features/manage-plans/model/plan-assignment.ts";
import { Card } from "@dev-template/ui/card";

export function PlanAssignment(props: {
  category: "business";
  candidates?: { value: string; label: string }[] | null;
  fixedTarget?: { id: string; name: string; planCode: string | null };
}) {
  const { category, candidates = null, fixedTarget } = props;

  const plans = usePlans(category);
  const mutation = useAssignPlan();
  return (
    <Card className="grid content-start gap-4 p-6">
      <h2 className="text-xl font-semibold">{translate("企業プラン")}</h2>
      <p className="text-sm text-muted-foreground">
        {translate("プランの割当によって利用できる機能が変わります。")}
      </p>
      {fixedTarget && <p className="font-medium">{fixedTarget.name}</p>}
      {plans.data !== null ? (
        <ActionForm
          key={fixedTarget ? `${fixedTarget.id}:${fixedTarget.planCode}` : category}
          label={fixedTarget ? translate("プランを変更") : translate("プランを割り当てる")}
          fields={planAssignmentFields(category, candidates, plans.data, fixedTarget)}
          onSubmit={async (v) => {
            await mutation.mutateAsync({
              category,
              id: fixedTarget?.id ?? v.id ?? "",
              planCode: v.planCode === UNASSIGNED_PLAN_OPTION ? null : (v.planCode ?? null),
            });
          }}
        />
      ) : (
        <p>{translate("プランを管理する権限がありません。")}</p>
      )}
    </Card>
  );
}
