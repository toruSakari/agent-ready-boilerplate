import { AccessRoleRolesOutputDto } from "#api/application/access/dtos/access-role-roles-output-dto.ts";
import { AccessRoleRolePermissionCatalogOutputDto } from "#api/application/access/dtos/access-role-role-permission-catalog-output-dto.ts";
import { AccessRoleSaveRoleOutputDto } from "#api/application/access/dtos/access-role-save-role-output-dto.ts";
import { AccessRoleAssignRoleOutputDto } from "#api/application/access/dtos/access-role-assign-role-output-dto.ts";
import { AccessRoleRemoveMemberOutputDto } from "#api/application/access/dtos/access-role-remove-member-output-dto.ts";
import type { AccessRoleRolesInputDto } from "#api/application/access/dtos/access-role-roles-input-dto.ts";
import type { AccessRoleRolePermissionCatalogInputDto } from "#api/application/access/dtos/access-role-role-permission-catalog-input-dto.ts";
import type { AccessRoleSaveRoleInputDto } from "#api/application/access/dtos/access-role-save-role-input-dto.ts";
import type { AccessRoleAssignRoleInputDto } from "#api/application/access/dtos/access-role-assign-role-input-dto.ts";
import type { AccessRoleRemoveMemberInputDto } from "#api/application/access/dtos/access-role-remove-member-input-dto.ts";
import { findPlanDefinition } from "#api/application/access/shared/find-plan-definition.ts";
import { canManageMemberService } from "#api/application/access/policies/member-service-boundary.ts";
import { permissionCodes } from "#api/application/access/mappers/permission-codes.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import {
  accessState,
  assertAssignableRole,
  assertBusinessOwnerRemovable,
  assertCustomerRole,
  assertOperatorAdministratorRemovable,
  inputValues,
  notFound,
  saveAccessChange,
} from "#api/application/access/shared/access-use-case-support.ts";
import {
  assertRoleEditable,
  assertRolePermissionDelegation,
  assertRolePlanLimit,
} from "#api/application/access/policies/validate-role-edit.ts";
import { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import { RoleEntity } from "#api/domain/access/entities/role.ts";
import {
  PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type {
  AccessRecords,
  AccessRepository,
} from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";

export class AccessRoleUseCases {
  constructor(
    private readonly repository: AccessRepository,
    private readonly reader: AccessReadRepository,
  ) {}

  async roles(inputDto: AccessRoleRolesInputDto): Promise<AccessRoleRolesOutputDto> {
    const { identity, scope } = inputDto;
    const state = accessState(identity, scope);
    return AccessRoleRolesOutputDto.parse({
      items: state.roles
        .filter((r) => r.scope === scope)
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          protectedRole: r.protectedRole,
          permissions: permissionCodes(r.permissions),
        })),
    });
  }

  async rolePermissionCatalog(
    inputDto: AccessRoleRolePermissionCatalogInputDto,
  ): Promise<AccessRoleRolePermissionCatalogOutputDto> {
    const { identity, scope } = inputDto;
    accessState(identity, scope);
    const actor = identity;
    const allowed =
      scope === PLATFORM_SCOPE
        ? PLATFORM_PERMISSIONS
        : ((await findPlanDefinition(this.reader, { category: "business", id: scope }))
            ?.permissions ?? []);
    const rolePermissions = actor.rolePermissions ?? actor.permissions;
    return AccessRoleRolePermissionCatalogOutputDto.parse(
      Object.fromEntries(
        allowed
          .filter(
            (permission) =>
              (actor.platform && scope !== PLATFORM_SCOPE) || rolePermissions.includes(permission),
          )
          .map((permission) => [permission, PERMISSIONS[permission]]),
      ),
    );
  }

  async saveRole(inputDto: AccessRoleSaveRoleInputDto): Promise<AccessRoleSaveRoleOutputDto> {
    const { identity, input } = inputDto;
    const command = { ...input };
    const state = accessState(identity, command.scope);
    const actor = identity;
    const permissions = inputValues(() =>
      command.permissions.map((p) => PermissionValue.create(p)),
    );
    assertRolePermissionDelegation(actor, command.scope, permissions);
    const existing = command.id
      ? state.roles.find((r) => r.id === command.id && r.scope === command.scope)
      : undefined;
    if (command.id && !existing) {
      notFound();
    }

    await assertRolePlanLimit(this.reader, command.scope, existing, permissions);
    assertRoleEditable(actor, command.scope, state, existing, permissions);
    const role = inputValues(
      () =>
        new RoleEntity(
          existing?.id ?? AccessId.create(crypto.randomUUID()),
          AccessId.create(command.scope),
          AccessName.create(command.name),
          permissions,
          false,
        ),
    );
    await saveAccessChange(
      this.repository,
      identity,
      command.scope,
      state,
      { roles: [role] },
      "role.save",
      role.id,
    );
    return AccessRoleSaveRoleOutputDto.parse({ id: String(role.id) });
  }

  private assertAssignable(
    state: AccessRecords,
    scope: string,
    roleId: string,
    actor: {
      permissions: readonly PermissionCode[];
      rolePermissions?: readonly PermissionCode[];
      protectedRole: boolean;
      platform: boolean;
    },
  ) {
    return assertAssignableRole(state, scope, roleId, actor);
  }

  private async assertRemovable(state: AccessRecords, membership: MembershipEntity) {
    if (membership.category === "business") {
      await assertBusinessOwnerRemovable(state, membership, this.reader);
    }

    if (membership.category === "operator") {
      await assertOperatorAdministratorRemovable(state, membership, this.reader);
    }
  }

  async assignRole(inputDto: AccessRoleAssignRoleInputDto): Promise<AccessRoleAssignRoleOutputDto> {
    const { identity, input } = inputDto;
    const command = { ...input };
    const state = accessState(identity, command.scope);
    const actor = identity;
    const member = state.memberships.find(
      (m) =>
        m.id === command.membershipId &&
        m.scope === command.scope &&
        canManageMemberService(identity, m.category),
    );
    if (!member) {
      notFound();
    }

    // 付与先だけでなく現在のロールも委任可能か確認し、より強い相手の権限剥奪を防ぐ。
    this.assertAssignable(state, command.scope, member.roleId, actor);
    const role = this.assertAssignable(state, command.scope, command.roleId, actor);
    if (member.category === "customer") {
      assertCustomerRole(role);
    }

    if (role.id !== member.roleId) {
      await this.assertRemovable(state, member);
    }

    await saveAccessChange(
      this.repository,
      identity,
      command.scope,
      state,
      {
        memberships: [
          new MembershipEntity(member.id, member.scope, member.userId, role.id, member.category),
        ],
      },
      "member.assign_role",
      member.userId,
    );
    return AccessRoleAssignRoleOutputDto.parse({ ok: true });
  }

  async removeMember(
    inputDto: AccessRoleRemoveMemberInputDto,
  ): Promise<AccessRoleRemoveMemberOutputDto> {
    const { identity, input } = inputDto;
    const command = { ...input };
    const state = accessState(identity, command.scope);
    const actor = identity;
    const member = state.memberships.find(
      (m) =>
        m.id === command.membershipId &&
        m.scope === command.scope &&
        canManageMemberService(identity, m.category),
    );
    if (!member) {
      notFound();
    }

    this.assertAssignable(state, command.scope, member.roleId, actor);
    await this.assertRemovable(state, member);
    await saveAccessChange(
      this.repository,
      identity,
      command.scope,
      state,
      { removeMembershipIds: [member.id] },
      "member.remove",
      member.userId,
    );
    return AccessRoleRemoveMemberOutputDto.parse({ ok: true });
  }
}
