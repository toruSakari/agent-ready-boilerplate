import type { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import type { RoleEntity } from "#api/domain/access/entities/role.ts";
import type { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import type { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import type {
  CustomerAccount,
  CustomerAccountEntity,
} from "#api/domain/access/entities/customer-account.ts";
import type {
  BusinessAccount,
  BusinessAccountEntity,
} from "#api/domain/access/entities/business-account.ts";
import type {
  OperatorAccount,
  OperatorAccountEntity,
} from "#api/domain/access/entities/operator-account.ts";
import type { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";

/** 同じ更新番号に結び付く復元済みの状態。保存までこのversionを保持する。 */
export type AccessRecords = Readonly<{
  version: number;
  organizations: readonly OrganizationEntity[];
  customerAccounts: readonly CustomerAccount[];
  businessAccounts: readonly BusinessAccount[];
  operatorAccounts: readonly OperatorAccount[];
  roles: readonly RoleEntity[];
  memberships: readonly MembershipEntity[];
  invitations: readonly InvitationEntity[];
}>;

/** 有効会員の保存と退会・停止を型で分け、対象サービスの取り違えを防ぐ。 */
export type AccessChange = Readonly<{
  planAssignments?: readonly PlanAssignment[];
  organizations?: readonly OrganizationEntity[];
  customerAccounts?: readonly CustomerAccountEntity<"active">[];
  businessAccounts?: readonly BusinessAccountEntity<"active">[];
  operatorAccounts?: readonly OperatorAccountEntity<"active">[];
  roles?: readonly RoleEntity[];
  memberships?: readonly MembershipEntity[];
  invitations?: readonly InvitationEntity[];
  removeMembershipIds?: readonly string[];
  removeInvitationIds?: readonly string[];
  withdrawnCustomerAccount?: CustomerAccountEntity<"withdrawn">;
  withdrawnBusinessAccount?: BusinessAccountEntity<"withdrawn">;
  stoppedOperatorAccount?: OperatorAccountEntity<"stopped">;
}>;

export type AuditEntry = Readonly<{
  id: string;
  actorId: string;
  scope: string;
  action: string;
  targetId: string;
  occurredAt: string;
}>;

export interface AccessRepository {
  load(scope: string): Promise<AccessRecords>;
  findInvitation(tokenHash: string): Promise<InvitationEntity | null>;
  /** 変更と監査を原子的に保存する。読取時の版と競合した場合は変更せずfalseを返す。 */
  commit(version: number, change: AccessChange, audit: AuditEntry): Promise<boolean>;
}
