import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { assertServiceEntry } from "#api/application/auth/policies/assert-service-entry.ts";
import { assertPermissions } from "#api/application/auth/policies/permissions.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

function deny(): never {
  throw new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
}

/** 保存済みの招待発行者の現在権限を検査し、招待承諾時にも委任権限が有効か確認する。 */
export async function authorizeInvitationIssuer(
  identity: Identity,
  scope: string,
  permission: PermissionCode,
  query: Pick<AccessQuery, "isRegistered" | "qualified" | "grant">,
) {
  await assertServiceEntry(identity, query);
  if (identity.channel === "admin") {
    const platform = await query.grant(identity.userId, PLATFORM_SCOPE);
    if (!platform) {
      deny();
    }

    assertPermissions(platform.permissions, [permission]);
    return { ...platform, platform: true };
  }

  if (
    identity.channel !== "business" ||
    scope === PLATFORM_SCOPE ||
    scope !== identity.tenantId ||
    !(await query.qualified(identity.userId, scope, "business"))
  ) {
    deny();
  }

  const grant = await query.grant(identity.userId, scope);
  if (!grant) {
    deny();
  }

  assertPermissions(grant.permissions, [permission]);
  return { ...grant, platform: false };
}
