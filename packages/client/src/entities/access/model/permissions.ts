import type { Permission } from "#client/entities/access/model/types";

export type PermissionMode = "all" | "any";

export type PermissionScope = "organization" | "platform";

/** 既定は全条件一致。空のrequiredはallで許可、anyで不許可となる。表示判断専用で認可境界ではない。 */
export function hasPermissions(
  granted: readonly Permission[],
  required: readonly Permission[],
  mode: PermissionMode = "all",
): boolean {
  const includes = (permission: Permission) => granted.includes(permission);
  return mode === "all" ? required.every(includes) : required.some(includes);
}
