import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { ApplicationErrorReason } from "#api/application/shared/application-error.ts";
import type { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import type { RoleEntity } from "#api/domain/access/entities/role.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import { CUSTOMER_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type {
  AccessChange,
  AccessRecords,
  AccessRepository,
} from "#api/domain/access/repositories/access-repository.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { z } from "zod";

export function deny(reason?: ApplicationErrorReason): never {
  throw new ApplicationError({
    code: "FORBIDDEN",
    reason,
    message: "この操作を行う権限がありません",
  });
}

/** 認可で固定した状態だけを使い、別スコープの状態で業務判断しない。 */
export function accessState(actor: AuthorizedActor, expectedScope: string): AccessRecords {
  const snapshot = actor.accessSnapshot;
  if (!snapshot || snapshot.scope !== expectedScope) {
    deny();
  }

  return snapshot.state;
}

export function conflict(message: string, reason?: ApplicationErrorReason): never {
  throw new ApplicationError({ code: "CONFLICT", reason, message });
}

export function notFound(): never {
  throw new ApplicationError({ code: "NOT_FOUND", message: "対象のデータが見つかりません" });
}

export function inputValues<T>(factory: () => T): T {
  try {
    return factory();
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof InvalidValueObjectError) {
      throw new ApplicationError({
        code: "BAD_REQUEST",
        message: "入力内容が不正です。入力内容を確認してください",
      });
    }

    throw error;
  }
}

export function verifiedSubject(identity: Identity) {
  // 認証アダプターが検証したsubjectだけを使い、会員IDやメールから本人を推測しない。
  if (!identity.subjectId) {
    deny();
  }

  return AuthenticationSubjectId.create(identity.subjectId);
}

/** ロール割当と招待の発行・承諾の各境界で、その時点のロールへ適用する。 */
export function assertCustomerRole(role: Pick<RoleEntity, "permissions" | "protectedRole">) {
  if (role.protectedRole || role.permissions.some((p) => !CUSTOMER_PERMISSIONS.includes(p))) {
    deny();
  }
}

export function assertAssignableRole(
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
  const role = state.roles.find((r) => r.id === roleId && r.scope === scope);
  if (!role) {
    notFound();
  }

  // 委任範囲にはプラン適用前のロールを使う。保護ロールの移譲と業務操作の実効権限を混同しない。
  if (
    !(actor.platform && scope !== PLATFORM_SCOPE) &&
    (role.permissions.some((p) => !(actor.rolePermissions ?? actor.permissions).includes(p)) ||
      (role.protectedRole && !actor.protectedRole))
  ) {
    deny();
  }

  return role;
}

export async function saveAccessChange(
  repository: AccessRepository,
  identity: Identity,
  scope: string,
  state: AccessRecords,
  change: AccessChange,
  action: string,
  targetId: string,
) {
  // 判断に用いた状態の版のまま保存し、競合後に最新の版へ差し替えて古い認可を再利用しない。
  if (
    !(await repository.commit(state.version, change, {
      id: crypto.randomUUID(),
      actorId: identity.userId,
      scope,
      action,
      targetId,
      occurredAt: new Date().toISOString(),
    }))
  ) {
    conflict("権限情報が更新されました。再読み込みしてください");
  }
}

// 他サービスの管理者では代替せず、同じ企業の別の有効な企業オーナーを必要とする。
export async function assertBusinessOwnerRemovable(
  state: AccessRecords,
  membership: MembershipEntity,
  repository: AccessReadRepository,
) {
  if (membership.category !== "business") {
    deny();
  }

  const role = state.roles.find((r) => r.id === membership.roleId && r.scope === membership.scope);
  if (
    !role?.protectedRole ||
    (await repository.findOtherProtectedMembership(membership.scope, membership.id))
  ) {
    return;
  }

  conflict(
    "最後のオーナー・運営管理者は削除・降格できません。先に同じサービスの会員へ権限を引き継いでください",
    "LAST_OWNER_REQUIRED",
  );
}

// 企業オーナーでは代替せず、platformに別の有効な運営管理者が残ることを確認する。
export async function assertOperatorAdministratorRemovable(
  state: AccessRecords,
  membership: MembershipEntity,
  repository: AccessReadRepository,
) {
  if (membership.category !== "operator" || membership.scope !== PLATFORM_SCOPE) {
    deny();
  }

  const role = state.roles.find((r) => r.id === membership.roleId && r.scope === PLATFORM_SCOPE);
  if (
    !role?.protectedRole ||
    (await repository.findOtherProtectedMembership(PLATFORM_SCOPE, membership.id))
  ) {
    return;
  }

  conflict(
    "最後のオーナー・運営管理者は削除・降格できません。先に同じサービスの会員へ権限を引き継いでください",
    "LAST_OWNER_REQUIRED",
  );
}

/** 招待の承諾で既存の所属を上書きせず、ロール変更の操作を別に要求する。 */
export function assertNewMembership(
  state: AccessRecords,
  category: AccountCategoryCode,
  scope: string,
  userId: string,
) {
  if (
    state.memberships.some(
      (m) => m.category === category && m.scope === scope && m.userId === userId,
    )
  ) {
    conflict("このサービスではすでに所属しています。ロール変更は別に行ってください");
  }
}
