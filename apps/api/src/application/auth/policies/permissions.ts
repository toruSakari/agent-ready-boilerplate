import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

/** 列挙された権限をすべて要求する。空配列は追加の権限を付与する意味ではない。 */
export function assertPermissions(
  granted: readonly PermissionCode[],
  required: readonly PermissionCode[],
) {
  if (!required.every((permission) => granted.includes(permission))) {
    throw new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
  }
}
