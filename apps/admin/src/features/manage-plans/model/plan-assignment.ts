import { t as translate } from "@dev-template/client/i18n";
import { ROUTE_PARAM_LIMITS } from "@dev-template/client/route-params";
import type { RouterOutputs } from "@dev-template/api-types";

// 未割当はフォーム上でも明示して選び、送信境界でAPIのnullへ戻す。
export const UNASSIGNED_PLAN_OPTION = "__unassigned_plan__";

/** 候補取得の可否に合わせて選択式・直接入力を組み立てる。 */
export function planAssignmentFields(
  _category: "business",
  candidates: { value: string; label: string }[] | null,
  plans: RouterOutputs["access"]["plans"],
  fixedTarget?: { id: string; name: string; planCode: string | null },
) {
  const fields = [
    {
      name: "id",
      label: translate("対象企業"),
      ...(candidates !== null
        ? { options: candidates }
        : { maxLength: ROUTE_PARAM_LIMITS.organizationIdMaxLength }),
    },
    {
      name: "planCode",
      label: translate("プラン"),
      initial: fixedTarget ? (fixedTarget.planCode ?? UNASSIGNED_PLAN_OPTION) : undefined,
      options: [
        { value: UNASSIGNED_PLAN_OPTION, label: translate("プランの割当を解除") },
        ...plans.map((p) => ({ value: p.code, label: p.name })),
      ],
    },
  ];
  return fixedTarget ? fields.filter((field) => field.name !== "id") : fields;
}
