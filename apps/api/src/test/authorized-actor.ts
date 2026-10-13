import type { Identity } from "#api/application/auth/contracts/identity.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";

/** テストでも本人確認と会員解決を分け、本番と同じ発行元・所属確認を通す。 */
export async function authenticateActor(
  provider: ServiceIdentityProvider,
  request: Request,
  selection: ServiceActor,
) {
  const authenticated = await provider.authenticate(request);
  return provider.resolveActor(
    authenticated,
    selection,
    request.headers.get("x-organization-id") ?? "",
  );
}

/** 外部本人確認とAccessQueryをfixtureへ置き換え、実際の会員解決・所属・権限ガードで認可済みActorを作る。 */
export async function authorizedActor(
  identity: Identity,
  required: readonly PermissionCode[] = identity.permissions,
) {
  const source = { ...identity, channel: identity.channel ?? ("business" as const) };
  const access: AccessQuery = {
    plans: () => [],
    plan: async () => ({ code: null, permissions: [] }),
    resolveAccount: async () => ({ id: source.userId, deleted: false }),
    isRegistered: async () => true,
    grant: async () => ({
      active: true,
      permissions: source.permissions,
      protectedRole: source.role === "admin",
    }),
    invitationIsCurrent: async () => true,
    hasQualifiedOwner: async () => true,
    qualified: async () => true,
    organizations: async () => [],
    audit: async () => [],
  };
  const provider = new AccountIdentityProvider({ authenticate: async () => source }, access);
  const authenticated = await authenticateActor(
    provider,
    new Request("https://api.test/", { headers: { "x-organization-id": source.tenantId } }),
    { service: source.channel === "admin" ? "operator" : source.channel },
  );
  return prepareAuthorizedActor(provider, authenticated, required);
}
