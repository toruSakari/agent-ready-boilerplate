import type { Permission } from "#api/domain/access/value-objects/permission.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";

/** 検証済み権限をAPIのコード一覧へ出力し、配列の所有権を持ち出さない。 */
export function permissionCodes(values: readonly Permission[]): readonly PermissionCode[] {
  return values.map(PermissionValue.toCode);
}
