"use client";
import { t as translate } from "#client/shared/i18n";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { usePermissions } from "#client/entities/access/api/use-permissions";
import type { PermissionMode, PermissionScope } from "#client/entities/access/model/permissions";
import type { Permission } from "#client/entities/access/model/types";

export type PermissionGateProps = {
  required: readonly Permission[];
  scope?: PermissionScope;
  mode?: PermissionMode;
  children: ReactNode;
  fallback?: ReactNode;
};

/** 権限確認が成功するまで子をマウントせず、子の業務クエリも開始させない表示ガード。 */
export function PermissionGate(props: PermissionGateProps) {
  const { required, scope = "organization", mode = "all", children, fallback } = props;

  const { hasPermissions } = usePermissions(scope);

  if (!hasPermissions(required, mode)) {
    // nullも呼び出し元が選んだ非表示として尊重し、既定のエラー表示へ置き換えない。
    return fallback !== undefined ? (
      fallback
    ) : (
      <Alert variant="destructive">
        <AlertDescription>{translate("このページを閲覧する権限がありません。")}</AlertDescription>
      </Alert>
    );
  }

  return children;
}
