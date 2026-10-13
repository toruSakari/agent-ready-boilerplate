import { accountRegistration } from "#api/application/access/shared/account-registration.ts";
import { OperatorAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/operator-account-remove-by-operator-input-dto.ts";
import { OperatorAccountStopInputDto } from "#api/application/access/dtos/operator-account-stop-input-dto.ts";
import { OperatorAccountRegisterFromInvitationInputDto } from "#api/application/access/dtos/operator-account-register-from-invitation-input-dto.ts";
import { BusinessAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/business-account-remove-by-operator-input-dto.ts";
import { BusinessAccountWithdrawInputDto } from "#api/application/access/dtos/business-account-withdraw-input-dto.ts";
import { BusinessAccountRegisterFromInvitationInputDto } from "#api/application/access/dtos/business-account-register-from-invitation-input-dto.ts";
import { CustomerAccountRemoveByOperatorInputDto } from "#api/application/access/dtos/customer-account-remove-by-operator-input-dto.ts";
import { CustomerAccountRegisterInputDto } from "#api/application/access/dtos/customer-account-register-input-dto.ts";
import { CustomerAccountWithdrawInputDto } from "#api/application/access/dtos/customer-account-withdraw-input-dto.ts";
import { CustomerAccountAcceptInvitationInputDto } from "#api/application/access/dtos/customer-account-accept-invitation-input-dto.ts";
import type { AccessOrganizationAssertBusinessIpInputDto as AccessAssertBusinessIpInputDto } from "#api/application/access/dtos/access-organization-assert-business-ip-input-dto.ts";
import type { AccessOrganizationAssertBusinessIpOutputDto as AccessAssertBusinessIpOutputDto } from "#api/application/access/dtos/access-organization-assert-business-ip-output-dto.ts";
import type { AccessOrganizationBusinessIpPolicyInputDto as AccessBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-business-ip-policy-input-dto.ts";
import type { AccessOrganizationBusinessIpPolicyOutputDto as AccessBusinessIpPolicyOutputDto } from "#api/application/access/dtos/access-organization-business-ip-policy-output-dto.ts";
import type { AccessOrganizationUpdateBusinessIpPolicyInputDto as AccessUpdateBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-update-business-ip-policy-input-dto.ts";
import type { AccessOrganizationUpdateBusinessIpPolicyOutputDto as AccessUpdateBusinessIpPolicyOutputDto } from "#api/application/access/dtos/access-organization-update-business-ip-policy-output-dto.ts";
import type { AccessOrganizationListPlansInputDto as AccessListPlansInputDto } from "#api/application/access/dtos/access-organization-list-plans-input-dto.ts";
import type { AccessOrganizationListPlansOutputDto as AccessListPlansOutputDto } from "#api/application/access/dtos/access-organization-list-plans-output-dto.ts";
import type { CustomerPlanPlansInputDto as AccessCustomerPlansInputDto } from "#api/application/access/dtos/customer-plan-plans-input-dto.ts";
import type { CustomerPlanPlansOutputDto as AccessCustomerPlansOutputDto } from "#api/application/access/dtos/customer-plan-plans-output-dto.ts";
import type { CustomerPlanChangeInputDto as AccessChangeCustomerPlanInputDto } from "#api/application/access/dtos/customer-plan-change-input-dto.ts";
import type { CustomerPlanChangeOutputDto as AccessChangeCustomerPlanOutputDto } from "#api/application/access/dtos/customer-plan-change-output-dto.ts";
import type { AccessOrganizationAssignPlanInputDto as AccessAssignPlanInputDto } from "#api/application/access/dtos/access-organization-assign-plan-input-dto.ts";
import type { AccessOrganizationAssignPlanOutputDto as AccessAssignPlanOutputDto } from "#api/application/access/dtos/access-organization-assign-plan-output-dto.ts";
import type { AccessOrganizationOrganizationPlanInputDto as AccessOrganizationPlanInputDto } from "#api/application/access/dtos/access-organization-organization-plan-input-dto.ts";
import type { AccessOrganizationOrganizationPlanOutputDto as AccessOrganizationPlanOutputDto } from "#api/application/access/dtos/access-organization-organization-plan-output-dto.ts";
import type { AccessOrganizationListOrganizationsInputDto as AccessListOrganizationsInputDto } from "#api/application/access/dtos/access-organization-list-organizations-input-dto.ts";
import type { AccessOrganizationListOrganizationsOutputDto as AccessListOrganizationsOutputDto } from "#api/application/access/dtos/access-organization-list-organizations-output-dto.ts";
import type { AccessOrganizationCreateOrganizationInputDto as AccessCreateOrganizationInputDto } from "#api/application/access/dtos/access-organization-create-organization-input-dto.ts";
import type { AccessOrganizationCreateOrganizationOutputDto as AccessCreateOrganizationOutputDto } from "#api/application/access/dtos/access-organization-create-organization-output-dto.ts";
import type { AccessOrganizationUpdateOrganizationInputDto as AccessUpdateOrganizationInputDto } from "#api/application/access/dtos/access-organization-update-organization-input-dto.ts";
import type { AccessOrganizationUpdateOrganizationOutputDto as AccessUpdateOrganizationOutputDto } from "#api/application/access/dtos/access-organization-update-organization-output-dto.ts";
import type { AccessDirectorySessionInputDto as AccessSessionInputDto } from "#api/application/access/dtos/access-directory-session-input-dto.ts";
import type { AccessDirectorySessionOutputDto as AccessSessionOutputDto } from "#api/application/access/dtos/access-directory-session-output-dto.ts";
import type { AccessDirectoryListMembersInputDto as AccessListMembersInputDto } from "#api/application/access/dtos/access-directory-list-members-input-dto.ts";
import type { AccessDirectoryListMembersOutputDto as AccessListMembersOutputDto } from "#api/application/access/dtos/access-directory-list-members-output-dto.ts";
import type { AccessDirectoryListUsersInputDto as AccessListUsersInputDto } from "#api/application/access/dtos/access-directory-list-users-input-dto.ts";
import type { AccessDirectoryListUsersOutputDto as AccessListUsersOutputDto } from "#api/application/access/dtos/access-directory-list-users-output-dto.ts";
import type { AccessDirectoryAuditInputDto as AccessAuditInputDto } from "#api/application/access/dtos/access-directory-audit-input-dto.ts";
import type { AccessDirectoryAuditOutputDto as AccessAuditOutputDto } from "#api/application/access/dtos/access-directory-audit-output-dto.ts";
import type { AccessRoleRolesInputDto as AccessRolesInputDto } from "#api/application/access/dtos/access-role-roles-input-dto.ts";
import type { AccessRoleRolesOutputDto as AccessRolesOutputDto } from "#api/application/access/dtos/access-role-roles-output-dto.ts";
import type { AccessRoleRolePermissionCatalogInputDto as AccessRolePermissionCatalogInputDto } from "#api/application/access/dtos/access-role-role-permission-catalog-input-dto.ts";
import type { AccessRoleRolePermissionCatalogOutputDto as AccessRolePermissionCatalogOutputDto } from "#api/application/access/dtos/access-role-role-permission-catalog-output-dto.ts";
import type { AccessRoleSaveRoleInputDto as AccessSaveRoleInputDto } from "#api/application/access/dtos/access-role-save-role-input-dto.ts";
import type { AccessRoleSaveRoleOutputDto as AccessSaveRoleOutputDto } from "#api/application/access/dtos/access-role-save-role-output-dto.ts";
import type { AccessRoleAssignRoleInputDto as AccessAssignRoleInputDto } from "#api/application/access/dtos/access-role-assign-role-input-dto.ts";
import type { AccessRoleAssignRoleOutputDto as AccessAssignRoleOutputDto } from "#api/application/access/dtos/access-role-assign-role-output-dto.ts";
import type { AccessRoleRemoveMemberInputDto as AccessRemoveMemberInputDto } from "#api/application/access/dtos/access-role-remove-member-input-dto.ts";
import type { AccessRoleRemoveMemberOutputDto as AccessRemoveMemberOutputDto } from "#api/application/access/dtos/access-role-remove-member-output-dto.ts";
import type { AccessInvitationInviteInputDto as AccessInviteInputDto } from "#api/application/access/dtos/access-invitation-invite-input-dto.ts";
import type { AccessInvitationInviteOutputDto as AccessInviteOutputDto } from "#api/application/access/dtos/access-invitation-invite-output-dto.ts";
import type { AccessDeleteUserInputDto } from "#api/application/access/dtos/access-delete-user-input-dto.ts";
import { AccessDeleteUserOutputDto } from "#api/application/access/dtos/access-delete-user-output-dto.ts";
import type { AccessRegistrationInputDto } from "#api/application/access/dtos/access-registration-input-dto.ts";
import type { AccessRegistrationOutputDto } from "#api/application/access/dtos/access-registration-output-dto.ts";
import type { AccessRegisterCustomerInputDto } from "#api/application/access/dtos/access-register-customer-input-dto.ts";
import { AccessRegisterCustomerOutputDto } from "#api/application/access/dtos/access-register-customer-output-dto.ts";
import type { AccessWithdrawInputDto } from "#api/application/access/dtos/access-withdraw-input-dto.ts";
import { AccessWithdrawOutputDto } from "#api/application/access/dtos/access-withdraw-output-dto.ts";
import type { AccessAcceptInvitationInputDto } from "#api/application/access/dtos/access-accept-invitation-input-dto.ts";
import { AccessAcceptInvitationOutputDto } from "#api/application/access/dtos/access-accept-invitation-output-dto.ts";
import type { AccessAuditStore } from "#api/application/access/stores/access-audit-store.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import { accountDirectory } from "#api/application/access/shared/account-directory.ts";
import { AccessDirectoryUseCases } from "#api/application/access/use-cases/access-directory-use-cases.ts";
import { AccessInvitationUseCases } from "#api/application/access/use-cases/access-invitation-use-cases.ts";
import { AccessOrganizationUseCases } from "#api/application/access/use-cases/access-organization-use-cases.ts";
import { AccessRoleUseCases } from "#api/application/access/use-cases/access-role-use-cases.ts";
import {
  accessState,
  deny,
  notFound,
} from "#api/application/access/shared/access-use-case-support.ts";
import { BusinessAccountUseCases } from "#api/application/access/use-cases/business-account-use-cases.ts";
import { CustomerPlanUseCases } from "#api/application/access/use-cases/customer-plan-use-cases.ts";
import { CustomerAccountUseCases } from "#api/application/access/use-cases/customer-account-use-cases.ts";
import { OperatorAccountUseCases } from "#api/application/access/use-cases/operator-account-use-cases.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";

export { INVITATION_TTL_MS } from "#api/application/access/use-cases/access-invitation-use-cases.ts";

/** 共通APIの窓口。企業・閲覧・ロール・招待とサービス別会員の操作を各ユースケースへ委譲する。 */
export class AccessUseCases {
  private readonly organizations: AccessOrganizationUseCases;
  private readonly directory: AccessDirectoryUseCases;
  private readonly roleManagement: AccessRoleUseCases;
  private readonly invitations: AccessInvitationUseCases;
  private readonly customerPlansUseCases: CustomerPlanUseCases;
  private readonly customerAccounts: CustomerAccountUseCases;
  private readonly businessAccounts: BusinessAccountUseCases;
  private readonly operatorAccounts: OperatorAccountUseCases;

  constructor(
    repository: AccessRepository,
    reader: AccessReadRepository,
    auditStore: AccessAuditStore,
  ) {
    this.organizations = new AccessOrganizationUseCases(repository, reader);
    this.directory = new AccessDirectoryUseCases(auditStore, reader);
    this.roleManagement = new AccessRoleUseCases(repository, reader);
    this.invitations = new AccessInvitationUseCases(repository);
    this.customerPlansUseCases = new CustomerPlanUseCases(repository, reader);
    this.customerAccounts = new CustomerAccountUseCases(repository, reader);
    this.businessAccounts = new BusinessAccountUseCases(repository, reader);
    this.operatorAccounts = new OperatorAccountUseCases(repository, reader);
  }

  assertBusinessIp(
    inputDto: AccessAssertBusinessIpInputDto,
  ): Promise<AccessAssertBusinessIpOutputDto> {
    return this.organizations.assertBusinessIp(inputDto);
  }

  businessIpPolicy(
    inputDto: AccessBusinessIpPolicyInputDto,
  ): Promise<AccessBusinessIpPolicyOutputDto> {
    return this.organizations.businessIpPolicy(inputDto);
  }

  updateBusinessIpPolicy(
    inputDto: AccessUpdateBusinessIpPolicyInputDto,
  ): Promise<AccessUpdateBusinessIpPolicyOutputDto> {
    return this.organizations.updateBusinessIpPolicy(inputDto);
  }

  listPlans(inputDto: AccessListPlansInputDto): Promise<AccessListPlansOutputDto> {
    return this.organizations.listPlans(inputDto);
  }

  customerPlans(inputDto: AccessCustomerPlansInputDto): Promise<AccessCustomerPlansOutputDto> {
    return this.customerPlansUseCases.plans(inputDto);
  }

  changeCustomerPlan(
    inputDto: AccessChangeCustomerPlanInputDto,
  ): Promise<AccessChangeCustomerPlanOutputDto> {
    return this.customerPlansUseCases.change(inputDto);
  }

  assignPlan(inputDto: AccessAssignPlanInputDto): Promise<AccessAssignPlanOutputDto> {
    return this.organizations.assignPlan(inputDto);
  }

  organizationPlan(
    inputDto: AccessOrganizationPlanInputDto,
  ): Promise<AccessOrganizationPlanOutputDto> {
    return this.organizations.organizationPlan(inputDto);
  }

  listOrganizations(
    inputDto: AccessListOrganizationsInputDto,
  ): Promise<AccessListOrganizationsOutputDto> {
    return this.organizations.listOrganizations(inputDto);
  }

  createOrganization(
    inputDto: AccessCreateOrganizationInputDto,
  ): Promise<AccessCreateOrganizationOutputDto> {
    return this.organizations.createOrganization(inputDto);
  }

  updateOrganization(
    inputDto: AccessUpdateOrganizationInputDto,
  ): Promise<AccessUpdateOrganizationOutputDto> {
    return this.organizations.updateOrganization(inputDto);
  }

  session(inputDto: AccessSessionInputDto): Promise<AccessSessionOutputDto> {
    return this.directory.session(inputDto);
  }

  listMembers(inputDto: AccessListMembersInputDto): Promise<AccessListMembersOutputDto> {
    return this.directory.listMembers(inputDto);
  }

  listUsers(inputDto: AccessListUsersInputDto): Promise<AccessListUsersOutputDto> {
    return this.directory.listUsers(inputDto);
  }

  audit(inputDto: AccessAuditInputDto): Promise<AccessAuditOutputDto> {
    return this.directory.audit(inputDto);
  }

  roles(inputDto: AccessRolesInputDto): Promise<AccessRolesOutputDto> {
    return this.roleManagement.roles(inputDto);
  }

  rolePermissionCatalog(
    inputDto: AccessRolePermissionCatalogInputDto,
  ): Promise<AccessRolePermissionCatalogOutputDto> {
    return this.roleManagement.rolePermissionCatalog(inputDto);
  }

  saveRole(inputDto: AccessSaveRoleInputDto): Promise<AccessSaveRoleOutputDto> {
    return this.roleManagement.saveRole(inputDto);
  }

  assignRole(inputDto: AccessAssignRoleInputDto): Promise<AccessAssignRoleOutputDto> {
    return this.roleManagement.assignRole(inputDto);
  }

  removeMember(inputDto: AccessRemoveMemberInputDto): Promise<AccessRemoveMemberOutputDto> {
    return this.roleManagement.removeMember(inputDto);
  }

  invite(inputDto: AccessInviteInputDto): Promise<AccessInviteOutputDto> {
    return this.invitations.invite(inputDto);
  }

  async deleteUser(inputDto: AccessDeleteUserInputDto): Promise<AccessDeleteUserOutputDto> {
    const { identity, userId } = inputDto;
    const state = accessState(identity, PLATFORM_SCOPE);
    const account = accountDirectory(state).find((a) => a.id === userId && !a.deleted);
    if (!account) {
      notFound();
    }

    switch (account.category) {
      case "customer":
        return AccessDeleteUserOutputDto.parse(
          await this.customerAccounts.removeByOperator(
            CustomerAccountRemoveByOperatorInputDto.parse({
              identity,
              accountId: account.id,
            }),
          ),
        );
      case "business":
        return AccessDeleteUserOutputDto.parse(
          await this.businessAccounts.removeByOperator(
            BusinessAccountRemoveByOperatorInputDto.parse({
              identity,
              accountId: account.id,
            }),
          ),
        );
      case "operator":
        return AccessDeleteUserOutputDto.parse(
          await this.operatorAccounts.removeByOperator(
            OperatorAccountRemoveByOperatorInputDto.parse({
              identity,
              accountId: account.id,
            }),
          ),
        );
    }

    return AccessDeleteUserOutputDto.parse({ ok: true });
  }

  async registration(inputDto: AccessRegistrationInputDto): Promise<AccessRegistrationOutputDto> {
    return accountRegistration(
      inputDto,
      this.customerAccounts,
      this.businessAccounts,
      this.operatorAccounts,
    );
  }

  async registerCustomer(
    inputDto: AccessRegisterCustomerInputDto,
  ): Promise<AccessRegisterCustomerOutputDto> {
    const { identity, input } = inputDto;
    return AccessRegisterCustomerOutputDto.parse(
      await this.customerAccounts.register(
        CustomerAccountRegisterInputDto.parse({ identity, input }),
      ),
    );
  }

  async withdraw(inputDto: AccessWithdrawInputDto): Promise<AccessWithdrawOutputDto> {
    const { identity } = inputDto;
    switch (identity.channel) {
      case "customer":
        return AccessWithdrawOutputDto.parse(
          await this.customerAccounts.withdraw(CustomerAccountWithdrawInputDto.parse({ identity })),
        );
      case "business":
        return AccessWithdrawOutputDto.parse(
          await this.businessAccounts.withdraw(BusinessAccountWithdrawInputDto.parse({ identity })),
        );
      case "admin":
        return AccessWithdrawOutputDto.parse(
          await this.operatorAccounts.stop(OperatorAccountStopInputDto.parse({ identity })),
        );
      default:
        return deny();
    }
  }

  async acceptInvitation(
    inputDto: AccessAcceptInvitationInputDto,
  ): Promise<AccessAcceptInvitationOutputDto> {
    const { identity, input } = inputDto;
    switch (identity.channel) {
      case "customer":
        return AccessAcceptInvitationOutputDto.parse(
          await this.customerAccounts.acceptInvitation(
            CustomerAccountAcceptInvitationInputDto.parse({ _identity: identity, _input: input }),
          ),
        );
      case "business":
        return AccessAcceptInvitationOutputDto.parse(
          await this.businessAccounts.registerFromInvitation(
            BusinessAccountRegisterFromInvitationInputDto.parse({
              identity,
              input,
            }),
          ),
        );
      case "admin":
        return AccessAcceptInvitationOutputDto.parse(
          await this.operatorAccounts.registerFromInvitation(
            OperatorAccountRegisterFromInvitationInputDto.parse({
              identity,
              input,
            }),
          ),
        );
      default:
        return deny();
    }
  }
}
