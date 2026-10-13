import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";
import type { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import type { AccessRecords } from "#api/domain/access/repositories/access-repository.ts";
import type { CustomerAccount } from "#api/domain/access/entities/customer-account.ts";
import type { BusinessAccount } from "#api/domain/access/entities/business-account.ts";
import type { OperatorAccount } from "#api/domain/access/entities/operator-account.ts";
import type { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import type { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import type { RoleEntity } from "#api/domain/access/entities/role.ts";
import type { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import type { PlanOwner, PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import type { AccessAuditEntry } from "#api/domain/access/entities/access-audit-entry.ts";

export type ServiceAccount = CustomerAccount | BusinessAccount | OperatorAccount;

export type AccessContext = Readonly<{
  account: ServiceAccount;
  roles: readonly RoleEntity[];
  organization: OrganizationEntity | null;
  plan: PlanAssignment | null;
}>;

export interface AccessReadRepository {
  plans(category: PlanCategory): readonly PlanDefinition[];
  organizationContexts(
    userId: string,
    category: AccountCategoryCode,
  ): Promise<
    readonly {
      organization: OrganizationEntity;
      role: RoleEntity;
    }[]
  >;
  grantContext(userId: string, scope: string): Promise<AccessContext | null>;
  load(scope: string): Promise<AccessRecords>;
  findAccount(subjectId: string, category: AccountCategoryCode): Promise<ServiceAccount | null>;
  findAccountById(id: string, category: AccountCategoryCode): Promise<ServiceAccount | null>;
  findPlan(owner: PlanOwner): Promise<PlanAssignment | null>;
  findCurrentInvitation(
    invitationId: string,
    subjectId: string,
    scope: string,
  ): Promise<InvitationEntity | null>;
  findOtherProtectedMembership(
    scope: string,
    excludingMembershipId: string,
  ): Promise<MembershipEntity | null>;
  findQualifiedMembership(
    userId: string,
    scope: string,
    category: AccountCategoryCode,
  ): Promise<MembershipEntity | null>;
  audit(scope: string): Promise<AccessAuditEntry[]>;
}
