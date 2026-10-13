import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import type { PlanOwner } from "#api/domain/access/entities/plan-assignment.ts";

export async function findPlanDefinition(
  repository: Pick<AccessReadRepository, "findPlan" | "plans">,
  owner: PlanOwner,
) {
  const assignment = await repository.findPlan(owner);
  return (
    repository.plans(owner.category).find((plan) => plan.code === assignment?.planCode) ?? null
  );
}
