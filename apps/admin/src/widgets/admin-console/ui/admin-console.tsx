import { AdminOverviewMetrics } from "#admin/widgets/admin-console/ui/admin-overview-metrics.tsx";
import { AdminWorkspaceActions } from "#admin/widgets/admin-console/ui/admin-workspace-actions.tsx";
import { AdminOrganizationPreview } from "#admin/widgets/admin-console/ui/admin-organization-preview.tsx";
import { t as translate } from "@dev-template/client/i18n";
import { useOrganizations, useUsers } from "#admin/entities/directory/index.ts";

export function AdminConsole() {
  const organizations = useOrganizations();
  const users = useUsers();
  return (
    <div className="grid gap-8">
      <header>
        <p className="mb-2 text-sm font-semibold text-highlight">
          {translate("運営ワークスペース")}
        </p>
        <h1 className="text-3xl font-bold">{translate("ダッシュボード")}</h1>
        <p className="mt-3 text-muted-foreground">
          {translate("企業とユーザーの状況を確認し、各管理画面へ移動できます。")}
        </p>
      </header>
      <AdminOverviewMetrics organizations={organizations.data} users={users.data} />
      <AdminWorkspaceActions />
      {organizations.data !== null && (
        <AdminOrganizationPreview organizations={organizations.data} />
      )}
    </div>
  );
}
