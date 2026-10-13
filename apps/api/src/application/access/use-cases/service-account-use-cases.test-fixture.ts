import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { BusinessAccountUseCases } from "#api/application/access/use-cases/business-account-use-cases.ts";
import { CustomerAccountUseCases } from "#api/application/access/use-cases/customer-account-use-cases.ts";
import { hashInvitation } from "#api/application/access/shared/invitation-token.ts";
import { OperatorAccountUseCases } from "#api/application/access/use-cases/operator-account-use-cases.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import { RoleEntity } from "#api/domain/access/entities/role.ts";
import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type {
  AccessRecords,
  AccessRepository,
} from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AccountCategoryValue } from "#api/domain/access/value-objects/account-category.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { expect, it, vi } from "vite-plus/test";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import { authenticateActor } from "#api/test/authorized-actor.ts";
import { lifecycleClients } from "#api/application/access/use-cases/service-account-clients.test-fixture.ts";
import {
  accessQuery,
  accessRecords,
  accessRepository,
} from "#api/application/access/use-cases/service-account-stores.test-fixture.ts";
import {
  business,
  EMAIL,
  INVITATION_TOKEN,
  operator,
  operatorIdentity,
  ORGANIZATION,
  PLATFORM,
} from "#api/application/access/use-cases/service-account-values.test-fixture.ts";
export {
  channels,
  entryPoints,
} from "#api/application/access/use-cases/service-account-entrypoints.test-fixture.ts";
export {
  business,
  customer,
  EMAIL,
  identity,
  INVITATION_TOKEN,
  operator,
  operatorIdentity,
  ORGANIZATION,
  PLATFORM,
  SUBJECT,
} from "#api/application/access/use-cases/service-account-values.test-fixture.ts";

export function setup(records: Partial<AccessRecords> = {}) {
  const state = accessRecords(records);
  const repository = accessRepository(state);
  const query = accessQuery(state);
  return { state, repository, query, ...lifecycleClients(repository, query, state) };
}

export type Fixture = ReturnType<typeof setup>;

export async function invited(
  category: AccountCategoryCode,
  records: Partial<AccessRecords> = {},
  rolePermissions: readonly PermissionCode[] = category === "operator"
    ? ["user.read"]
    : ["order:read"],
  protectedRole = false,
) {
  const scope = category === "operator" ? PLATFORM : ORGANIZATION;
  const role = new RoleEntity(
    AccessId.create(`role:${category}`),
    scope,
    AccessName.create("招待先ロール"),
    rolePermissions.map((value) => PermissionValue.create(value)),
    protectedRole,
  );
  const invitation = new InvitationEntity(
    AccessId.create(`invitation:${category}`),
    scope,
    EMAIL,
    role.id,
    await hashInvitation(INVITATION_TOKEN),
    "2099-01-01T00:00:00.000Z",
    AccessId.create(operatorIdentity.userId),
    AccountCategoryValue.create(category),
    "admin",
  );
  return {
    ...setup({ ...records, roles: [role], invitations: [invitation] }),
    invitation,
  };
}

export function protectedMemberships() {
  const ownerRole = new RoleEntity(
    AccessId.create("role:owner"),
    ORGANIZATION,
    AccessName.create("企業オーナー"),
    BUSINESS_PERMISSIONS.map((value) => PermissionValue.create(value)),
    true,
  );
  const administratorRole = new RoleEntity(
    AccessId.create("role:administrator"),
    PLATFORM,
    AccessName.create("運営管理者"),
    PLATFORM_PERMISSIONS.map((value) => PermissionValue.create(value)),
    true,
  );
  const owner = new MembershipEntity(
    AccessId.create("membership:owner"),
    ORGANIZATION,
    business.id,
    ownerRole.id,
    AccountCategoryValue.create("business"),
  );
  const administrator = new MembershipEntity(
    AccessId.create("membership:administrator"),
    PLATFORM,
    operator.id,
    administratorRole.id,
    AccountCategoryValue.create("operator"),
  );
  return { roles: [ownerRole, administratorRole], memberships: [owner, administrator] };
}

export {
  AccessId,
  AccessName,
  AccountCategoryValue,
  AccountIdentityProvider,
  authenticateActor,
  AuthenticationSubjectId,
  BUSINESS_PERMISSIONS,
  BusinessAccountEntity,
  BusinessAccountId,
  BusinessAccountUseCases,
  CUSTOMER_PERMISSIONS,
  CustomerAccountEntity,
  CustomerAccountId,
  CustomerAccountUseCases,
  EmailAddress,
  expect,
  hashInvitation,
  InvitationEntity,
  invokeRuntime,
  it,
  MembershipEntity,
  OperatorAccountEntity,
  OperatorAccountId,
  OperatorAccountUseCases,
  OrganizationEntity,
  PermissionValue,
  PLATFORM_PERMISSIONS,
  PLATFORM_SCOPE,
  prepareAuthorizedActor,
  RoleEntity,
  vi,
};

export type {
  AccessQuery,
  AccessRecords,
  AccessRepository,
  AccountCategoryCode,
  AuthorizedActor,
  Identity,
  PermissionCode,
  ServiceActor,
};
