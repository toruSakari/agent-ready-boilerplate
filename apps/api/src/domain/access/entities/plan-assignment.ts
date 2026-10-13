import type { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";

/** 企業プランの所有者は企業、個人プランの所有者は一つの通常会員アカウント。 */
export type PlanOwner = Readonly<{ category: PlanCategory; id: string }>;

export type PlanAssignmentSnapshot = PlanOwner & Readonly<{ planCode: string | null }>;

export class PlanAssignment {
  constructor(
    readonly category: PlanCategory,
    readonly id: AccessId,
    /** nullは割当解除。既定プランへの切替を意味しない。 */
    readonly planCode: AccessId | null,
  ) {
    Object.freeze(this);
  }

  toSnapshot(): PlanAssignmentSnapshot {
    return { category: this.category, id: this.id, planCode: this.planCode };
  }
}
