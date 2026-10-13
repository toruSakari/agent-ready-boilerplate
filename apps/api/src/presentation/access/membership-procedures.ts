import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { AccessInvitationInviteInputDto } from "#api/application/access/dtos/access-invitation-invite-input-dto.ts";
import { AccessRoleRolesInputDto } from "#api/application/access/dtos/access-role-roles-input-dto.ts";
import { AccessRoleRolePermissionCatalogInputDto } from "#api/application/access/dtos/access-role-role-permission-catalog-input-dto.ts";
import { AccessRoleSaveRoleInputDto } from "#api/application/access/dtos/access-role-save-role-input-dto.ts";
import { AccessRoleAssignRoleInputDto } from "#api/application/access/dtos/access-role-assign-role-input-dto.ts";
import { AccessRoleRemoveMemberInputDto } from "#api/application/access/dtos/access-role-remove-member-input-dto.ts";
import { AccessDirectoryListMembersInputDto } from "#api/application/access/dtos/access-directory-list-members-input-dto.ts";
import { AccessDirectoryAuditInputDto } from "#api/application/access/dtos/access-directory-audit-input-dto.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import {
  requireAccessPermissions,
  requireAccessScope,
  scopeSchema,
  scopedInput,
} from "#api/presentation/access/middleware/trpc-authorization.ts";
import { z } from "zod";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import { requireActor } from "#api/presentation/shared/middleware/trpc-authorization.ts";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";

export const membershipProcedures = t.router({
  members: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["member.read"]))
    .query((props) =>
      props.ctx.container.access
        .listMembers(
          parseInputDto(AccessDirectoryListMembersInputDto, {
            identity: props.ctx.actor,
            scope: props.input.scope,
          }),
        )
        .then((result) => result.items),
    ),
  roles: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["member.read"]))
    .query((props) =>
      props.ctx.container.access
        .roles(
          parseInputDto(AccessRoleRolesInputDto, {
            identity: props.ctx.actor,
            scope: props.input.scope,
          }),
        )
        .then((result) => result.items),
    ),
  rolePermissionCatalog: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["role.manage"]))
    .query((props) =>
      props.ctx.container.access.rolePermissionCatalog(
        parseInputDto(AccessRoleRolePermissionCatalogInputDto, {
          identity: props.ctx.actor,
          scope: props.input.scope,
        }),
      ),
    ),
  saveRole: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["role.manage"]))
    .input(
      z.object({
        id: scopeSchema.optional(),
        name: z.string().trim().min(1).max(ACCESS_LIMITS.nameMaxLength),
        permissions: z.array(z.string()).max(ACCESS_LIMITS.permissionsMaxCount),
      }),
    )
    .mutation((props) =>
      props.ctx.container.access.saveRole(
        parseInputDto(AccessRoleSaveRoleInputDto, {
          identity: props.ctx.actor,
          input: props.input,
        }),
      ),
    ),
  // serviceは発行者、actorKindは招待先のサービスであり、両者を同一視しない。
  invite: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["member.invite"]))
    .input(
      z.object({
        email: z.email().max(ACCESS_LIMITS.emailMaxLength),
        roleId: scopeSchema,
        actorKind: z.enum(ACCOUNT_CATEGORIES),
      }),
    )
    .mutation((props) =>
      props.ctx.container.access.invite(
        parseInputDto(AccessInvitationInviteInputDto, {
          identity: props.ctx.actor,
          input: props.input,
        }),
      ),
    ),
  assignRole: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["member.assign_role"]))
    .input(z.object({ membershipId: scopeSchema, roleId: scopeSchema }))
    .mutation((props) =>
      props.ctx.container.access
        .assignRole(
          parseInputDto(AccessRoleAssignRoleInputDto, {
            identity: props.ctx.actor,
            input: props.input,
          }),
        )
        .then(() => undefined),
    ),
  removeMember: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["member.remove"]))
    .input(z.object({ membershipId: scopeSchema }))
    .mutation((props) =>
      props.ctx.container.access
        .removeMember(
          parseInputDto(AccessRoleRemoveMemberInputDto, {
            identity: props.ctx.actor,
            input: props.input,
          }),
        )
        .then(() => undefined),
    ),
  audit: procedure
    .use(requireActor(["business", "operator"]))
    .use(requireBusinessIp)
    .input(scopedInput)
    .use(requireAccessScope)
    .use(requireAccessPermissions(["audit.read"]))
    .query((props) =>
      props.ctx.container.access
        .audit(
          parseInputDto(AccessDirectoryAuditInputDto, {
            identity: props.ctx.actor,
            scope: props.input.scope,
          }),
        )
        .then((result) => result.items),
    ),
});
