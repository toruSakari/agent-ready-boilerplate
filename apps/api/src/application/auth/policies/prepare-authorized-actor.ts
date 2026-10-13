import type {
  AuthorizedActor,
  AuthorizedAccessSnapshot,
} from "#api/application/auth/contracts/authorized-actor.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import type { AuthorizationGrant } from "#api/application/auth/contracts/authorization-grant.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

/** ライフサイクル用途と企業スコープを、許可された実行者へ混在させない。 */
function assertGrantScope(
  grant: AuthorizationGrant,
  demanded: readonly PermissionCode[],
  accessSnapshot?: AuthorizedAccessSnapshot,
) {
  if (
    !grant.identity.channel ||
    (grant.purpose && (demanded.length > 0 || accessSnapshot)) ||
    !snapshotScopeAllowed(grant, demanded, accessSnapshot)
  ) {
    throw new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
  }

  return grant.identity.channel;
}

/** 個人の変更は本人IDだけを扱い、企業・platformのAccess状態で代替しない。 */
function snapshotScopeAllowed(
  grant: AuthorizationGrant,
  demanded: readonly PermissionCode[],
  snapshot?: AuthorizedAccessSnapshot,
) {
  if (!snapshot || grant.platform) {
    return true;
  }

  if (grant.identity.channel === "customer") {
    return demanded.length === 0 && snapshot.scope === grant.identity.userId;
  }

  return snapshot.scope !== PLATFORM_SCOPE && snapshot.scope === grant.identity.tenantId;
}

/** 現在権限を検査し、各操作へ独立した不変のActorを渡す。権限の宣言はミドルウェアが所有する。 */
export async function prepareAuthorizedActor(
  provider: ServiceIdentityProvider,
  identity: Identity,
  required: readonly PermissionCode[],
  snapshot?: AuthorizedAccessSnapshot,
): Promise<AuthorizedActor> {
  const demanded = Object.freeze([...required]);
  // 認可のawaitより前に要求・状態・版を固定し、待機中の呼出元の書換えを持ち込まない。
  const accessSnapshot = snapshot
    ? Object.freeze({
        scope: snapshot.scope,
        state: Object.freeze({
          ...snapshot.state,
          organizations: Object.freeze([...snapshot.state.organizations]),
          customerAccounts: Object.freeze([...snapshot.state.customerAccounts]),
          businessAccounts: Object.freeze([...snapshot.state.businessAccounts]),
          operatorAccounts: Object.freeze([...snapshot.state.operatorAccounts]),
          roles: Object.freeze([...snapshot.state.roles]),
          memberships: Object.freeze([...snapshot.state.memberships]),
          invitations: Object.freeze([...snapshot.state.invitations]),
        }),
      })
    : undefined;
  const grant = await provider.authorize(identity, demanded);
  const channel = assertGrantScope(grant, demanded, accessSnapshot);
  return Object.freeze({
    ...grant.identity,
    service: channel === "admin" ? "operator" : channel,
    permissions: Object.freeze([...grant.permissions]),
    rolePermissions: Object.freeze([...(grant.rolePermissions ?? grant.permissions)]),
    protectedRole: grant.protectedRole,
    platform: grant.platform,
    ...(grant.purpose ? { purpose: grant.purpose } : {}),
    ...(accessSnapshot ? { accessSnapshot } : {}),
  });
}
