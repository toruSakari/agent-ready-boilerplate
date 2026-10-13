import { AccessDirectorySessionOutputDto } from "#api/application/access/dtos/access-directory-session-output-dto.ts";
import { AccessDirectoryListMembersOutputDto } from "#api/application/access/dtos/access-directory-list-members-output-dto.ts";
import { AccessDirectoryListUsersOutputDto } from "#api/application/access/dtos/access-directory-list-users-output-dto.ts";
import { AccessDirectoryAuditOutputDto } from "#api/application/access/dtos/access-directory-audit-output-dto.ts";
import type { AccessDirectorySessionInputDto } from "#api/application/access/dtos/access-directory-session-input-dto.ts";
import type { AccessDirectoryListMembersInputDto } from "#api/application/access/dtos/access-directory-list-members-input-dto.ts";
import type { AccessDirectoryListUsersInputDto } from "#api/application/access/dtos/access-directory-list-users-input-dto.ts";
import type { AccessDirectoryAuditInputDto } from "#api/application/access/dtos/access-directory-audit-input-dto.ts";
import type { AccessAuditStore } from "#api/application/access/stores/access-audit-store.ts";
import { canManageMemberService } from "#api/application/access/policies/member-service-boundary.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import { accountDirectory } from "#api/application/access/shared/account-directory.ts";
import { accessState } from "#api/application/access/shared/access-use-case-support.ts";
import {
  CUSTOMER_PERMISSIONS,
  PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";

export class AccessDirectoryUseCases {
  constructor(
    private readonly auditStore: AccessAuditStore,
    private readonly reader: AccessReadRepository,
  ) {}

  async session(
    inputDto: AccessDirectorySessionInputDto,
  ): Promise<AccessDirectorySessionOutputDto> {
    const { identity } = inputDto;
    const organizations =
      identity.channel === "business"
        ? await this.reader.organizationContexts(identity.userId, "business")
        : [];
    return AccessDirectorySessionOutputDto.parse({
      userId: identity.userId,
      channel: identity.channel,
      organizations: organizations.map((props) => ({
        id: String(props.organization.id),
        name: String(props.organization.name),
        roleName: String(props.role.name),
      })),
      platformPermissions: identity.platform ? identity.permissions : [],
      permissions: (identity.platform ? [] : identity.permissions).filter(
        (p) => identity.channel !== "customer" || CUSTOMER_PERMISSIONS.includes(p),
      ),
      permissionCatalog: PERMISSIONS,
    });
  }

  async listMembers(
    inputDto: AccessDirectoryListMembersInputDto,
  ): Promise<AccessDirectoryListMembersOutputDto> {
    const { identity, scope } = inputDto;
    const state = accessState(identity, scope);
    const actor = identity;
    // 運営の基本一覧権限と個人情報閲覧を分離し、メールを返す閲覧は監査へ記録する。
    const personal = actor.platform ? actor.permissions.includes("user.personal.read") : true;
    if (personal) {
      await this.auditStore.appendAudit({
        id: crypto.randomUUID(),
        actorId: identity.userId,
        scope,
        action: "member.personal.read",
        targetId: scope,
        occurredAt: new Date().toISOString(),
      });
    }

    return AccessDirectoryListMembersOutputDto.parse({
      items: state.memberships
        .filter((m) => m.scope === scope && canManageMemberService(identity, m.category))
        .map((m) => {
          const account = accountDirectory(state).find(
            (a) => a.id === m.userId && a.category === m.category,
          );
          const role = state.roles.find((r) => r.id === m.roleId && r.scope === scope);
          if (!account || !role) {
            throw new Error("所属情報が不正です");
          }

          return {
            id: String(m.id),
            userId: String(account.id),
            category: account.category,
            name: String(account.name),
            email: personal && account.email !== null ? String(account.email) : null,
            roleId: String(role.id),
            roleName: String(role.name),
            protectedRole: role.protectedRole,
          };
        }),
    });
  }

  async listUsers(
    inputDto: AccessDirectoryListUsersInputDto,
  ): Promise<AccessDirectoryListUsersOutputDto> {
    const { identity } = inputDto;
    const personal = identity.permissions.includes("user.personal.read");
    const state = accessState(identity, PLATFORM_SCOPE);
    if (personal) {
      await this.auditStore.appendAudit({
        id: crypto.randomUUID(),
        actorId: identity.userId,
        scope: PLATFORM_SCOPE,
        action: "user.personal.read",
        targetId: "directory",
        occurredAt: new Date().toISOString(),
      });
    }

    return AccessDirectoryListUsersOutputDto.parse({
      items: accountDirectory(state)
        .filter((a) => !a.deleted)
        .map((a) => ({
          id: String(a.id),
          category: a.category,
          name: String(a.name),
          email: personal && a.email !== null ? String(a.email) : null,
          memberships: userMemberships(state, a),
        })),
    });
  }

  async audit(inputDto: AccessDirectoryAuditInputDto): Promise<AccessDirectoryAuditOutputDto> {
    const { identity, scope } = inputDto;
    accessState(identity, scope);
    return AccessDirectoryAuditOutputDto.parse({
      items: (await this.reader.audit(scope)).map((entry) => entry.toSnapshot()),
    });
  }
}

function userMemberships(
  state: ReturnType<typeof accessState>,
  account: ReturnType<typeof accountDirectory>[number],
) {
  return state.memberships
    .filter((m) => m.userId === account.id && account.category !== "customer")
    .map((m) => ({
      id: String(m.id),
      scope: String(m.scope),
      organizationName: state.organizations.find((o) => o.id === m.scope)?.name ?? "運営",
      roleName: state.roles.find((r) => r.id === m.roleId)?.name ?? "",
      roleId: String(m.roleId),
    }));
}
