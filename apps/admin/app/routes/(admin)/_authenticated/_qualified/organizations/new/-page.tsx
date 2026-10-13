import { AdminCreateOrganization } from "#admin/widgets/admin-console/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function OrganizationsNewPage() {
  return (
    <DataErrorBoundary>
      <AdminCreateOrganization />
    </DataErrorBoundary>
  );
}
