import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { IdentityProvider } from "#api/application/auth/providers/identity-provider.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import type { AuthorizationGrant } from "#api/application/auth/contracts/authorization-grant.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { assertServiceEntry } from "#api/application/auth/policies/assert-service-entry.ts";
import { assertPermissions } from "#api/application/auth/policies/permissions.ts";
import {
  CUSTOMER_PERMISSIONS,
  BUSINESS_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

type AccessGrant = Awaited<ReturnType<AccessQuery["grant"]>>;

function permissionCeiling(channel: Identity["channel"]) {
  if (channel === "admin") {
    return PLATFORM_PERMISSIONS;
  }

  return channel === "customer" ? CUSTOMER_PERMISSIONS : BUSINESS_PERMISSIONS;
}

function initialPermissions(channel: Identity["channel"], grant: AccessGrant) {
  if (channel === "admin") {
    return [];
  }

  return (grant?.permissions ?? []).filter(
    (permission) => channel !== "customer" || CUSTOMER_PERMISSIONS.includes(permission),
  );
}

function activeAccountId(account: Awaited<ReturnType<AccessQuery["resolveAccount"]>>) {
  return account && !account.deleted ? account.id : "";
}

function lifecycleGrant(
  identity: Identity,
  selection: ServiceActor,
  required: readonly PermissionCode[],
): AuthorizationGrant {
  if (required.length > 0) {
    throw new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
  }

  return {
    identity,
    permissions: [],
    protectedRole: false,
    platform: identity.channel === "admin",
    purpose: selection.purpose,
  };
}

function delegationPermissions(grant: AccessGrant, ceiling: readonly PermissionCode[]) {
  return (grant?.rolePermissions ?? grant?.permissions ?? []).filter((permission) =>
    ceiling.includes(permission),
  );
}

function currentGrant(
  identity: Identity,
  grant: AccessGrant,
  required: readonly PermissionCode[],
): AuthorizationGrant {
  const ceiling = permissionCeiling(identity.channel);
  const permissions = (grant?.permissions ?? []).filter((permission) =>
    ceiling.includes(permission),
  );
  assertPermissions(permissions, required);
  return {
    identity: { ...identity, permissions, role: grant?.protectedRole ? "admin" : "member" },
    permissions,
    // 委任可能範囲には、実行用のプラン上限適用前のロール権限を残す。
    rolePermissions: delegationPermissions(grant, ceiling),
    protectedRole: grant?.protectedRole ?? false,
    platform: identity.channel === "admin",
  };
}

function actorScope(selection: ServiceActor, channel: Identity["channel"], tenantId: string) {
  return selection.purpose !== undefined || channel === "admin" ? "" : tenantId;
}

function resolvedIdentity(
  authenticated: Identity,
  subjectId: string,
  userId: string,
  channel: Identity["channel"],
  scope: string,
  grant: AccessGrant,
): Identity {
  return Object.freeze({
    ...authenticated,
    subjectId,
    userId,
    channel,
    tenantId: scope,
    role: grant?.protectedRole ? ("admin" as const) : ("member" as const),
    permissions: Object.freeze(initialPermissions(channel, grant)),
  });
}

/** 本人確認のアダプターと会員照会ポートを組み合わせ、会員解決・現在権限の方針を扱う。 */
export class AccountIdentityProvider implements ServiceIdentityProvider {
  // 本人確認と会員解決の出所を分け、構造が同じコピーや別プロバイダーの発行物を拒否する。
  private readonly authenticated = new WeakSet<Identity>();
  private readonly issued = new WeakMap<Identity, ServiceActor>();

  constructor(
    private readonly authentication: IdentityProvider,
    private readonly access: AccessQuery,
  ) {}

  async authenticate(request: Request): Promise<Identity> {
    const authenticated = await this.authentication.authenticate(request);
    const identity: Identity = Object.freeze({
      ...authenticated,
      permissions: Object.freeze([...authenticated.permissions]),
    });
    this.authenticated.add(identity);
    return identity;
  }

  private async scopeGrant(userId: string, scope: string) {
    return scope && userId ? this.access.grant(userId, scope) : null;
  }

  async resolveActor(
    authenticated: Identity,
    actor: ServiceActor,
    tenantId: string,
  ): Promise<Identity> {
    if (!this.authenticated.has(authenticated)) {
      throw new ApplicationError({ code: "FORBIDDEN", message: "認証済みの本人情報が必要です" });
    }

    if (!actor || !ACCOUNT_CATEGORIES.includes(actor.service)) {
      throw new ApplicationError({
        code: "BAD_REQUEST",
        message: "操作するサービスを指定してください",
      });
    }

    const selection = Object.freeze({ ...actor });
    const category = selection.service;
    const channel = category === "operator" ? "admin" : category;
    const subjectId = authenticated.subjectId ?? authenticated.userId;
    const account = await this.access.resolveAccount(subjectId, category);
    const onboarding = selection.purpose !== undefined;
    // ライフサイクル操作は確認済みsubjectとサービスに結び付け、企業ヘッダーで範囲を変えない。
    const scope = actorScope(selection, channel, tenantId);
    const userId = activeAccountId(account);
    const grant = await this.scopeGrant(userId, scope);
    if (scope && !grant?.active) {
      throw new ApplicationError({
        code: "FORBIDDEN",
        message: "この企業を利用する権限がありません",
      });
    }

    const identity = resolvedIdentity(authenticated, subjectId, userId, channel, scope, grant);
    if (!onboarding) {
      await assertServiceEntry(identity, this.access);
    }

    this.issued.set(identity, selection);
    return identity;
  }

  async authorize(
    identity: Identity,
    required: readonly PermissionCode[],
  ): Promise<AuthorizationGrant> {
    const selection = this.issued.get(identity);
    if (!selection) {
      throw new ApplicationError({ code: "FORBIDDEN", message: "認証済みの会員が必要です" });
    }

    if (selection.purpose) {
      return lifecycleGrant(identity, selection, required);
    }

    // 認証時や以前の呼び出しの権限を流用せず、現在の会員・所属・プラン適用済み権限を再検査する。
    await assertServiceEntry(identity, this.access);
    const scope = identity.channel === "admin" ? PLATFORM_SCOPE : identity.tenantId;
    const grant = scope ? await this.access.grant(identity.userId, scope) : null;
    if ((scope || required.length > 0) && !grant?.active) {
      throw new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
    }

    return currentGrant(identity, grant, required);
  }
}
