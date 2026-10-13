import { AdminOrganizationDetail } from "#admin/widgets/admin-console/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { Route } from "#app/routes/(admin)/_authenticated/_qualified/organizations/$organizationId/route.ts";

export function OrganizationsOrganizationidPage() {
  const { organizationId } = Route.useParams();
  return (
    <DataErrorBoundary>
      <AdminOrganizationDetail organizationId={organizationId} />
    </DataErrorBoundary>
  );
}
