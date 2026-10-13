import { useOrganizationPlan } from "#admin/features/manage-plans/api/use-plans.ts";
import { PlanAssignment } from "#admin/features/manage-plans/ui/plan-assignment.tsx";

/** 詳細の企業を固定し、保存後は再取得した現在プランをフォームへ反映する。 */
export function OrganizationPlan(props: { id: string; name: string }) {
  const plan = useOrganizationPlan(props.id);
  if (plan.data === null) {
    return null;
  }

  return (
    <PlanAssignment
      category="business"
      fixedTarget={{ id: props.id, name: props.name, planCode: plan.data.code }}
    />
  );
}
