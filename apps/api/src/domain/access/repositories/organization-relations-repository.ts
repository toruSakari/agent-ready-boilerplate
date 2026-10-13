import type { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import type { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";

export interface OrganizationRelationsRepository {
  plans(organizationIds: readonly string[]): Promise<PlanAssignment[]>;
  members(organizationIds: readonly string[]): Promise<MembershipEntity[]>;
}
