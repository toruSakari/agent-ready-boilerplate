import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import { AccessOrganizationAssertBusinessIpOutputDto } from "#api/application/access/dtos/access-organization-assert-business-ip-output-dto.ts";
import { AccessOrganizationBusinessIpPolicyOutputDto } from "#api/application/access/dtos/access-organization-business-ip-policy-output-dto.ts";
import { AccessOrganizationUpdateBusinessIpPolicyOutputDto } from "#api/application/access/dtos/access-organization-update-business-ip-policy-output-dto.ts";
import { AccessOrganizationListPlansOutputDto } from "#api/application/access/dtos/access-organization-list-plans-output-dto.ts";
import { AccessOrganizationAssignPlanOutputDto } from "#api/application/access/dtos/access-organization-assign-plan-output-dto.ts";
import { AccessOrganizationOrganizationPlanOutputDto } from "#api/application/access/dtos/access-organization-organization-plan-output-dto.ts";
import { AccessOrganizationListOrganizationsOutputDto } from "#api/application/access/dtos/access-organization-list-organizations-output-dto.ts";
import { AccessOrganizationCreateOrganizationOutputDto } from "#api/application/access/dtos/access-organization-create-organization-output-dto.ts";
import { AccessOrganizationUpdateOrganizationOutputDto } from "#api/application/access/dtos/access-organization-update-organization-output-dto.ts";
import type { AccessOrganizationAssertBusinessIpInputDto } from "#api/application/access/dtos/access-organization-assert-business-ip-input-dto.ts";
import type { AccessOrganizationBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-business-ip-policy-input-dto.ts";
import type { AccessOrganizationUpdateBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-update-business-ip-policy-input-dto.ts";
import type { AccessOrganizationListPlansInputDto } from "#api/application/access/dtos/access-organization-list-plans-input-dto.ts";
import type { AccessOrganizationAssignPlanInputDto } from "#api/application/access/dtos/access-organization-assign-plan-input-dto.ts";
import type { AccessOrganizationOrganizationPlanInputDto } from "#api/application/access/dtos/access-organization-organization-plan-input-dto.ts";
import type { AccessOrganizationListOrganizationsInputDto } from "#api/application/access/dtos/access-organization-list-organizations-input-dto.ts";
import type { AccessOrganizationCreateOrganizationInputDto } from "#api/application/access/dtos/access-organization-create-organization-input-dto.ts";
import type { AccessOrganizationUpdateOrganizationInputDto } from "#api/application/access/dtos/access-organization-update-organization-input-dto.ts";
import { permissionCodes } from "#api/application/access/mappers/permission-codes.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import {
  accessState,
  deny,
  inputValues,
  notFound,
  saveAccessChange,
} from "#api/application/access/shared/access-use-case-support.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import { RoleEntity } from "#api/domain/access/entities/role.ts";
import { BUSINESS_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";

export class AccessOrganizationUseCases {
  constructor(
    private readonly repository: AccessRepository,
    private readonly reader: AccessReadRepository,
  ) {}

  async assertBusinessIp(
    inputDto: AccessOrganizationAssertBusinessIpInputDto,
  ): Promise<AccessOrganizationAssertBusinessIpOutputDto> {
    const { scope, clientIp } = inputDto;
    if (!scope) {
      return AccessOrganizationAssertBusinessIpOutputDto.parse({ ok: true });
    }

    const state = await this.repository.load(scope);
    const organization = state.organizations.find((o) => o.id === scope);
    if (!organization || !organization.allowsBusinessIp(clientIp)) {
      throw new ApplicationError({
        code: "FORBIDDEN",
        message: "このIPアドレスからは企業画面を利用できません",
      });
    }

    return AccessOrganizationAssertBusinessIpOutputDto.parse({ ok: true });
  }

  async businessIpPolicy(
    inputDto: AccessOrganizationBusinessIpPolicyInputDto,
  ): Promise<AccessOrganizationBusinessIpPolicyOutputDto> {
    const { identity, id } = inputDto;
    const organization = accessState(identity, PLATFORM_SCOPE).organizations.find(
      (o) => o.id === id,
    );
    if (!organization) {
      notFound();
    }

    return AccessOrganizationBusinessIpPolicyOutputDto.parse({
      enabled: organization.businessIpRestrictionEnabled,
      allowedIps: organization.businessAllowedIps.map(String),
    });
  }

  async updateBusinessIpPolicy(
    inputDto: AccessOrganizationUpdateBusinessIpPolicyInputDto,
  ): Promise<AccessOrganizationUpdateBusinessIpPolicyOutputDto> {
    const { identity, input } = inputDto;
    const state = accessState(identity, PLATFORM_SCOPE);
    const organization = state.organizations.find((o) => o.id === input.id);
    if (!organization) {
      notFound();
    }

    const updated = inputValues(
      () =>
        new OrganizationEntity(
          organization.id,
          organization.name,
          organization.active,
          organization.invitationsEnabled,
          input.enabled,
          input.allowedIps.map((entry) => AllowedIpRange.create(entry)),
        ),
    );
    await saveAccessChange(
      this.repository,
      identity,
      PLATFORM_SCOPE,
      state,
      {
        organizations: [updated],
      },
      "organization.business_ip_policy.update",
      input.id,
    );
    return AccessOrganizationUpdateBusinessIpPolicyOutputDto.parse({ ok: true });
  }

  async listPlans(
    inputDto: AccessOrganizationListPlansInputDto,
  ): Promise<AccessOrganizationListPlansOutputDto> {
    const { _identity, category } = inputDto;
    if (category !== "business") {
      deny();
    }

    return AccessOrganizationListPlansOutputDto.parse({
      items: this.reader.plans(category).map((plan) => ({
        code: String(plan.code),
        name: String(plan.name),
        category: plan.category,
        permissions: permissionCodes(plan.permissions),
      })),
    });
  }

  async assignPlan(
    inputDto: AccessOrganizationAssignPlanInputDto,
  ): Promise<AccessOrganizationAssignPlanOutputDto> {
    const { identity, input } = inputDto;
    const command = { ...input };
    if (command.category !== "business") {
      deny();
    }

    const state = accessState(identity, PLATFORM_SCOPE);
    const exists = state.organizations.some((organization) => organization.id === command.id);
    if (!exists) {
      notFound();
    }

    const plan =
      command.planCode === null
        ? null
        : this.reader
            .plans(command.category)
            .find((candidate) => candidate.code === command.planCode);
    if (command.planCode !== null && !plan) {
      deny();
    }

    await saveAccessChange(
      this.repository,
      identity,
      PLATFORM_SCOPE,
      state,
      {
        planAssignments: [
          new PlanAssignment(command.category, AccessId.create(command.id), plan?.code ?? null),
        ],
      },
      "plan.assign",
      command.id,
    );
    return AccessOrganizationAssignPlanOutputDto.parse({ ok: true });
  }

  async organizationPlan(
    inputDto: AccessOrganizationOrganizationPlanInputDto,
  ): Promise<AccessOrganizationOrganizationPlanOutputDto> {
    const { identity, id } = inputDto;
    const state = accessState(identity, PLATFORM_SCOPE);
    if (!state.organizations.some((organization) => organization.id === id)) {
      notFound();
    }

    // 詳細で選択した企業だけを照会し、全企業一覧でプランを一件ずつ読み込まない。
    const plan = await this.reader.findPlan({ category: "business", id });
    return AccessOrganizationOrganizationPlanOutputDto.parse({
      code: plan?.planCode === null || !plan ? null : String(plan.planCode),
    });
  }

  async listOrganizations(
    inputDto: AccessOrganizationListOrganizationsInputDto,
  ): Promise<AccessOrganizationListOrganizationsOutputDto> {
    const { identity } = inputDto;
    const state = accessState(identity, PLATFORM_SCOPE);
    return AccessOrganizationListOrganizationsOutputDto.parse({
      items: state.organizations.map((o) => ({
        id: String(o.id),
        name: String(o.name),
        active: o.active,
        invitationsEnabled: o.invitationsEnabled,
        memberCount: state.memberships.filter((m) => m.scope === o.id).length,
      })),
    });
  }

  async createOrganization(
    inputDto: AccessOrganizationCreateOrganizationInputDto,
  ): Promise<AccessOrganizationCreateOrganizationOutputDto> {
    const { identity, input } = inputDto;
    const command = { ...input };
    const state = accessState(identity, PLATFORM_SCOPE);
    const id = AccessId.create(crypto.randomUUID());
    const organization = inputValues(
      () => new OrganizationEntity(id, AccessName.create(command.name), true, false),
    );
    // 企業と初期ロールだけを作り、会員の所属やプランはこの操作で自動付与しない。
    const roles = [
      new RoleEntity(
        AccessId.create(`${id}:owner`),
        id,
        AccessName.create("オーナー"),
        BUSINESS_PERMISSIONS.map((value) => PermissionValue.create(value)),
        true,
      ),
      new RoleEntity(
        AccessId.create(`${id}:admin`),
        id,
        AccessName.create("管理者"),
        BUSINESS_PERMISSIONS.filter((p) => p !== "role.manage").map((value) =>
          PermissionValue.create(value),
        ),
        false,
      ),
      new RoleEntity(
        AccessId.create(`${id}:staff`),
        id,
        AccessName.create("スタッフ"),
        ["order:read", "product.read"].map((value) => PermissionValue.create(value)),
        false,
      ),
    ];
    await saveAccessChange(
      this.repository,
      identity,
      PLATFORM_SCOPE,
      state,
      { organizations: [organization], roles },
      "organization.create",
      id,
    );
    return AccessOrganizationCreateOrganizationOutputDto.parse({ id: String(id) });
  }

  async updateOrganization(
    inputDto: AccessOrganizationUpdateOrganizationInputDto,
  ): Promise<AccessOrganizationUpdateOrganizationOutputDto> {
    const { identity, input } = inputDto;
    const command = { ...input };
    const state = accessState(identity, PLATFORM_SCOPE);
    const organization = state.organizations.find((o) => o.id === command.id);
    if (!organization) {
      notFound();
    }

    const updated = inputValues(
      () =>
        new OrganizationEntity(
          organization.id,
          AccessName.create(command.name),
          command.active,
          command.invitationsEnabled,
          organization.businessIpRestrictionEnabled,
          organization.businessAllowedIps,
        ),
    );
    await saveAccessChange(
      this.repository,
      identity,
      PLATFORM_SCOPE,
      state,
      { organizations: [updated] },
      "organization.update",
      organization.id,
    );
    return AccessOrganizationUpdateOrganizationOutputDto.parse({ ok: true });
  }
}
