import { AdminOrganizations } from "#admin/widgets/admin-console/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function OrganizationsPage() {
  return (
    <DataErrorBoundary>
      <AdminOrganizations />
    </DataErrorBoundary>
  );
}
