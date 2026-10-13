import { OperatorAccountRegistrationInputDto } from "#api/application/access/dtos/operator-account-registration-input-dto.ts";
import { OperatorAccountRegisterFromInvitationInputDto } from "#api/application/access/dtos/operator-account-register-from-invitation-input-dto.ts";
import { OperatorAccountStopInputDto } from "#api/application/access/dtos/operator-account-stop-input-dto.ts";
import { OperatorAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/operator-account-remove-by-operator-input-dto.ts";
import { BusinessAccountRegistrationInputDto } from "#api/application/access/dtos/business-account-registration-input-dto.ts";
import { BusinessAccountRegisterFromInvitationInputDto } from "#api/application/access/dtos/business-account-register-from-invitation-input-dto.ts";
import { BusinessAccountWithdrawInputDto } from "#api/application/access/dtos/business-account-withdraw-input-dto.ts";
import { BusinessAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/business-account-remove-by-operator-input-dto.ts";
import { CustomerAccountRegistrationInputDto } from "#api/application/access/dtos/customer-account-registration-input-dto.ts";
import { CustomerAccountRegisterInputDto } from "#api/application/access/dtos/customer-account-register-input-dto.ts";
import { CustomerAccountAcceptInvitationInputDto } from "#api/application/access/dtos/customer-account-accept-invitation-input-dto.ts";
import { CustomerAccountWithdrawInputDto } from "#api/application/access/dtos/customer-account-withdraw-input-dto.ts";
import { CustomerAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/customer-account-remove-by-operator-input-dto.ts";
import { AccessDeleteUserInputDto } from "#api/application/access/dtos/access-delete-user-input-dto.ts";
import { AccessRegistrationInputDto } from "#api/application/access/dtos/access-registration-input-dto.ts";
import { AccessRegisterCustomerInputDto } from "#api/application/access/dtos/access-register-customer-input-dto.ts";
import { AccessWithdrawInputDto } from "#api/application/access/dtos/access-withdraw-input-dto.ts";
import { AccessAcceptInvitationInputDto } from "#api/application/access/dtos/access-accept-invitation-input-dto.ts";
import { AccessInvitationInviteInputDto } from "#api/application/access/dtos/access-invitation-invite-input-dto.ts";
import { CustomerPlanPlansInputDto } from "#api/application/access/dtos/customer-plan-plans-input-dto.ts";
import { CustomerPlanChangeInputDto } from "#api/application/access/dtos/customer-plan-change-input-dto.ts";
import { AccessRoleRolesInputDto } from "#api/application/access/dtos/access-role-roles-input-dto.ts";
import { AccessRoleRolePermissionCatalogInputDto } from "#api/application/access/dtos/access-role-role-permission-catalog-input-dto.ts";
import { AccessRoleSaveRoleInputDto } from "#api/application/access/dtos/access-role-save-role-input-dto.ts";
import { AccessRoleAssignRoleInputDto } from "#api/application/access/dtos/access-role-assign-role-input-dto.ts";
import { AccessRoleRemoveMemberInputDto } from "#api/application/access/dtos/access-role-remove-member-input-dto.ts";
import { AccessDirectorySessionInputDto } from "#api/application/access/dtos/access-directory-session-input-dto.ts";
import { AccessDirectoryListMembersInputDto } from "#api/application/access/dtos/access-directory-list-members-input-dto.ts";
import { AccessDirectoryListUsersInputDto } from "#api/application/access/dtos/access-directory-list-users-input-dto.ts";
import { AccessDirectoryAuditInputDto } from "#api/application/access/dtos/access-directory-audit-input-dto.ts";
import { AccessOrganizationAssertBusinessIpInputDto } from "#api/application/access/dtos/access-organization-assert-business-ip-input-dto.ts";
import { AccessOrganizationBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-business-ip-policy-input-dto.ts";
import { AccessOrganizationUpdateBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-update-business-ip-policy-input-dto.ts";
import { AccessOrganizationListPlansInputDto } from "#api/application/access/dtos/access-organization-list-plans-input-dto.ts";
import { AccessOrganizationAssignPlanInputDto } from "#api/application/access/dtos/access-organization-assign-plan-input-dto.ts";
import { AccessOrganizationOrganizationPlanInputDto } from "#api/application/access/dtos/access-organization-organization-plan-input-dto.ts";
import { AccessOrganizationListOrganizationsInputDto } from "#api/application/access/dtos/access-organization-list-organizations-input-dto.ts";
import { AccessOrganizationCreateOrganizationInputDto } from "#api/application/access/dtos/access-organization-create-organization-input-dto.ts";
import { AccessOrganizationUpdateOrganizationInputDto } from "#api/application/access/dtos/access-organization-update-organization-input-dto.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { AccessUseCases } from "#api/application/access/use-cases/access-use-cases.ts";

import type { CustomerAccountUseCases } from "#api/application/access/use-cases/customer-account-use-cases.ts";

import type { BusinessAccountUseCases } from "#api/application/access/use-cases/business-account-use-cases.ts";

import type { OperatorAccountUseCases } from "#api/application/access/use-cases/operator-account-use-cases.ts";

type AccessUseCasesInputs = {
  [K in keyof AccessUseCases]: Parameters<AccessUseCases[K]>[0];
};

type CustomerAccountUseCasesInputs = {
  [K in keyof CustomerAccountUseCases]: Parameters<CustomerAccountUseCases[K]>[0];
};

type BusinessAccountUseCasesInputs = {
  [K in keyof BusinessAccountUseCases]: Parameters<BusinessAccountUseCases[K]>[0];
};

type OperatorAccountUseCasesInputs = {
  [K in keyof OperatorAccountUseCases]: Parameters<OperatorAccountUseCases[K]>[0];
};

function ipPolicyTestCalls(useCases: AccessUseCases) {
  return {
    assertBusinessIp: (
      scope: AccessUseCasesInputs["assertBusinessIp"]["scope"],
      clientIp: AccessUseCasesInputs["assertBusinessIp"]["clientIp"],
    ) =>
      useCases
        .assertBusinessIp(AccessOrganizationAssertBusinessIpInputDto.parse({ scope, clientIp }))
        .then(() => undefined),
    businessIpPolicy: (
      identity: AuthorizedActor,
      id: AccessUseCasesInputs["businessIpPolicy"]["id"],
    ) =>
      useCases.businessIpPolicy(AccessOrganizationBusinessIpPolicyInputDto.parse({ identity, id })),
    updateBusinessIpPolicy: (
      identity: AuthorizedActor,
      input: AccessUseCasesInputs["updateBusinessIpPolicy"]["input"],
    ) =>
      useCases
        .updateBusinessIpPolicy(
          AccessOrganizationUpdateBusinessIpPolicyInputDto.parse({ identity, input }),
        )
        .then(() => undefined),
  };
}

function organizationsTestCalls(useCases: AccessUseCases) {
  return {
    ...ipPolicyTestCalls(useCases),
    listPlans: (
      _identity: AuthorizedActor,
      category: AccessUseCasesInputs["listPlans"]["category"],
    ) =>
      useCases
        .listPlans(AccessOrganizationListPlansInputDto.parse({ _identity, category }))
        .then((result) => result.items),
    assignPlan: (identity: AuthorizedActor, input: AccessUseCasesInputs["assignPlan"]["input"]) =>
      useCases
        .assignPlan(AccessOrganizationAssignPlanInputDto.parse({ identity, input }))
        .then(() => undefined),
    organizationPlan: (
      identity: AuthorizedActor,
      id: AccessUseCasesInputs["organizationPlan"]["id"],
    ) =>
      useCases.organizationPlan(AccessOrganizationOrganizationPlanInputDto.parse({ identity, id })),
    listOrganizations: (identity: AuthorizedActor) =>
      useCases
        .listOrganizations(AccessOrganizationListOrganizationsInputDto.parse({ identity }))
        .then((result) => result.items),
    createOrganization: (
      identity: AuthorizedActor,
      input: AccessUseCasesInputs["createOrganization"]["input"],
    ) =>
      useCases.createOrganization(
        AccessOrganizationCreateOrganizationInputDto.parse({ identity, input }),
      ),
    updateOrganization: (
      identity: AuthorizedActor,
      input: AccessUseCasesInputs["updateOrganization"]["input"],
    ) =>
      useCases
        .updateOrganization(AccessOrganizationUpdateOrganizationInputDto.parse({ identity, input }))
        .then(() => undefined),
  };
}

function directoryTestCalls(useCases: AccessUseCases) {
  return {
    session: (identity: AuthorizedActor) =>
      useCases.session(AccessDirectorySessionInputDto.parse({ identity })),
    listMembers: (identity: AuthorizedActor, scope: AccessUseCasesInputs["listMembers"]["scope"]) =>
      useCases
        .listMembers(AccessDirectoryListMembersInputDto.parse({ identity, scope }))
        .then((result) => result.items),
    listUsers: (identity: AuthorizedActor) =>
      useCases
        .listUsers(AccessDirectoryListUsersInputDto.parse({ identity }))
        .then((result) => result.items),
    audit: (identity: AuthorizedActor, scope: AccessUseCasesInputs["audit"]["scope"]) =>
      useCases
        .audit(AccessDirectoryAuditInputDto.parse({ identity, scope }))
        .then((result) => result.items),
  };
}

function rolesTestCalls(useCases: AccessUseCases) {
  return {
    roles: (identity: AuthorizedActor, scope: AccessUseCasesInputs["roles"]["scope"]) =>
      useCases
        .roles(AccessRoleRolesInputDto.parse({ identity, scope }))
        .then((result) => result.items),
    rolePermissionCatalog: (
      identity: AuthorizedActor,
      scope: AccessUseCasesInputs["rolePermissionCatalog"]["scope"],
    ) =>
      useCases.rolePermissionCatalog(
        AccessRoleRolePermissionCatalogInputDto.parse({ identity, scope }),
      ),
    saveRole: (identity: AuthorizedActor, input: AccessUseCasesInputs["saveRole"]["input"]) =>
      useCases.saveRole(AccessRoleSaveRoleInputDto.parse({ identity, input })),
    assignRole: (identity: AuthorizedActor, input: AccessUseCasesInputs["assignRole"]["input"]) =>
      useCases
        .assignRole(AccessRoleAssignRoleInputDto.parse({ identity, input }))
        .then(() => undefined),
    removeMember: (
      identity: AuthorizedActor,
      input: AccessUseCasesInputs["removeMember"]["input"],
    ) =>
      useCases
        .removeMember(AccessRoleRemoveMemberInputDto.parse({ identity, input }))
        .then(() => undefined),
  };
}

function accountsTestCalls(useCases: AccessUseCases) {
  return {
    customerPlans: (identity: AuthorizedActor) =>
      useCases.customerPlans(CustomerPlanPlansInputDto.parse({ identity })),
    changeCustomerPlan: (
      identity: AuthorizedActor,
      input: AccessUseCasesInputs["changeCustomerPlan"]["input"],
    ) =>
      useCases
        .changeCustomerPlan(CustomerPlanChangeInputDto.parse({ identity, input }))
        .then(() => undefined),
    invite: (identity: AuthorizedActor, input: AccessUseCasesInputs["invite"]["input"]) =>
      useCases.invite(AccessInvitationInviteInputDto.parse({ identity, input })),
    deleteUser: (identity: AuthorizedActor, userId: AccessUseCasesInputs["deleteUser"]["userId"]) =>
      useCases
        .deleteUser(AccessDeleteUserInputDto.parse({ identity, userId }))
        .then(() => undefined),
    registration: (identity: AuthorizedActor) =>
      useCases.registration(AccessRegistrationInputDto.parse({ identity })),
    registerCustomer: (
      identity: AuthorizedActor,
      input: AccessUseCasesInputs["registerCustomer"]["input"],
    ) => useCases.registerCustomer(AccessRegisterCustomerInputDto.parse({ identity, input })),
    withdraw: (identity: AuthorizedActor) =>
      useCases.withdraw(AccessWithdrawInputDto.parse({ identity })),
    acceptInvitation: (
      identity: AuthorizedActor,
      input: AccessUseCasesInputs["acceptInvitation"]["input"],
    ) => useCases.acceptInvitation(AccessAcceptInvitationInputDto.parse({ identity, input })),
  };
}

export function accessUseCaseTestCalls(useCases: AccessUseCases) {
  return {
    ...organizationsTestCalls(useCases),
    ...directoryTestCalls(useCases),
    ...rolesTestCalls(useCases),
    ...accountsTestCalls(useCases),
  };
}

export function customerAccountTestCalls(useCases: CustomerAccountUseCases) {
  return {
    registration: (identity: AuthorizedActor) =>
      useCases.registration(CustomerAccountRegistrationInputDto.parse({ identity })),
    register: (
      identity: AuthorizedActor,
      input: CustomerAccountUseCasesInputs["register"]["input"],
    ) => useCases.register(CustomerAccountRegisterInputDto.parse({ identity, input })),
    acceptInvitation: (
      _identity: AuthorizedActor,
      _input: CustomerAccountUseCasesInputs["acceptInvitation"]["_input"],
    ) =>
      useCases.acceptInvitation(
        CustomerAccountAcceptInvitationInputDto.parse({ _identity, _input }),
      ),
    withdraw: (identity: AuthorizedActor) =>
      useCases.withdraw(CustomerAccountWithdrawInputDto.parse({ identity })),
    removeByOperator: (
      identity: AuthorizedActor,
      accountId: CustomerAccountUseCasesInputs["removeByOperator"]["accountId"],
    ) =>
      useCases
        .removeByOperator(CustomerAccountRemoveByOperatorInputDto.parse({ identity, accountId }))
        .then(() => undefined),
  };
}

export function businessAccountTestCalls(useCases: BusinessAccountUseCases) {
  return {
    registration: (identity: AuthorizedActor) =>
      useCases.registration(BusinessAccountRegistrationInputDto.parse({ identity })),
    registerFromInvitation: (
      identity: AuthorizedActor,
      input: BusinessAccountUseCasesInputs["registerFromInvitation"]["input"],
    ) =>
      useCases.registerFromInvitation(
        BusinessAccountRegisterFromInvitationInputDto.parse({ identity, input }),
      ),
    withdraw: (identity: AuthorizedActor) =>
      useCases.withdraw(BusinessAccountWithdrawInputDto.parse({ identity })),
    removeByOperator: (
      identity: AuthorizedActor,
      accountId: BusinessAccountUseCasesInputs["removeByOperator"]["accountId"],
    ) =>
      useCases
        .removeByOperator(BusinessAccountRemoveByOperatorInputDto.parse({ identity, accountId }))
        .then(() => undefined),
  };
}

export function operatorAccountTestCalls(useCases: OperatorAccountUseCases) {
  return {
    registration: (identity: AuthorizedActor) =>
      useCases.registration(OperatorAccountRegistrationInputDto.parse({ identity })),
    registerFromInvitation: (
      identity: AuthorizedActor,
      input: OperatorAccountUseCasesInputs["registerFromInvitation"]["input"],
    ) =>
      useCases.registerFromInvitation(
        OperatorAccountRegisterFromInvitationInputDto.parse({ identity, input }),
      ),
    stop: (identity: AuthorizedActor) =>
      useCases.stop(OperatorAccountStopInputDto.parse({ identity })),
    removeByOperator: (
      identity: AuthorizedActor,
      accountId: OperatorAccountUseCasesInputs["removeByOperator"]["accountId"],
    ) =>
      useCases
        .removeByOperator(OperatorAccountRemoveByOperatorInputDto.parse({ identity, accountId }))
        .then(() => undefined),
  };
}
