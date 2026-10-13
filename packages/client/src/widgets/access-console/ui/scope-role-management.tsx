"use client";
import { ScopeRoleEditors } from "#client/widgets/access-console/ui/scope-role-editors";
import { t as translate } from "#client/shared/i18n";
import { DataSkeleton } from "#client/shared/ui/error-boundary";
import { usePermissions, useRoles, useRolePermissionCatalog } from "#client/entities/access";
import { isForbiddenQueryError } from "#client/shared/api/query-access";
import { Card } from "@dev-template/ui/card";
import { scopeRoleChoices } from "#client/widgets/access-console/model/role-choices";
import { PLATFORM_SCOPE } from "#client/widgets/access-console/ui/access-scope";

export function ScopeRoleManagement(props: { scope: string; platform?: boolean }) {
  const { scope, platform = false } = props;

  const { session, can } = usePermissions(platform ? "platform" : "organization");
  const roles = useRoles(scope);
  const rolePermissionCatalog = useRolePermissionCatalog(scope, can("role.manage"));
  const roleCatalogForbidden = isForbiddenQueryError(rolePermissionCatalog.error);
  const { editableRoles } = scopeRoleChoices(
    roles.data ?? undefined,
    scope === PLATFORM_SCOPE ? "operator" : "business",
  );
  return (
    <section className="grid gap-4">
      {can("role.manage") && !roleCatalogForbidden && (
        <Card className="grid gap-5 p-5">
          <h3 className="font-semibold">{translate("カスタムロール作成")}</h3>

          {rolePermissionCatalog.isPending && (
            <DataSkeleton label={translate("許可する操作を確認しています…")} />
          )}
          {rolePermissionCatalog.isSuccess && (
            <ScopeRoleEditors
              scope={scope}
              catalog={rolePermissionCatalog.data}
              roles={editableRoles}
              permissionLabels={session.data.permissionCatalog}
            />
          )}
        </Card>
      )}
    </section>
  );
}
