import { Link } from "@tanstack/react-router";
import { t as translate } from "@dev-template/client/i18n";
import { usePermissions } from "@dev-template/client/entities/access";
import { Button } from "@dev-template/ui/button";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { useListSearch, organizationListSearchSchema } from "@dev-template/client/list-filters";
import { OrganizationFilters } from "#admin/widgets/admin-console/ui/organization-filters.tsx";
import { AdminOrganizationResults } from "#admin/widgets/admin-console/ui/admin-organization-results.tsx";

export function AdminOrganizations() {
  const { can } = usePermissions("platform");
  const search = useListSearch(organizationListSearchSchema);
  const { q, ...filters } = search.value;
  return (
    <div className="grid min-w-0 gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{translate("企業一覧")}</h1>
          <p className="mt-2 text-muted-foreground">
            {translate("企業の利用状態、メンバー、アクセス設定を管理します。")}
          </p>
        </div>
        {can("organization.manage") && (
          <Button asChild>
            <Link to="/organizations/new">{translate("企業を作成")}</Link>
          </Button>
        )}
      </header>
      <DataErrorBoundary resetKey={search.key}>
        <OrganizationFilters />
      </DataErrorBoundary>
      <DataErrorBoundary resetKey={search.key}>
        <AdminOrganizationResults key={search.key} filters={{ ...filters, search: q }} />
      </DataErrorBoundary>
    </div>
  );
}
