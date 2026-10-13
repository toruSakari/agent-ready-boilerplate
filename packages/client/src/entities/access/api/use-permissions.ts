"use client";
import { useAccessSession } from "#client/entities/access/api/use-access";
import { hasPermissions } from "#client/entities/access/model/permissions";
import type { PermissionMode, PermissionScope } from "#client/entities/access/model/permissions";
import type { Permission } from "#client/entities/access/model/types";

/** UIの操作可否を提供する。企業権限と運営権限は代替せず、API側の認可も別途必要。 */
export function usePermissions(scope: PermissionScope = "organization") {
  const session = useAccessSession();
  // Suspenseが初回確認を待ち、再取得失敗はuseAccessSessionがthrowする。
  const permissions =
    scope === "platform" ? session.data.platformPermissions : session.data.permissions;
  return {
    session,
    permissions,
    can: (permission: Permission) => permissions.includes(permission),
    hasPermissions: (required: readonly Permission[], mode: PermissionMode = "all") =>
      hasPermissions(permissions, required, mode),
  };
}
