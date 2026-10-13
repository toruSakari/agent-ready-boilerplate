import { AdminOrganizationDetail } from "#admin/widgets/admin-console/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { Route } from "#app/routes/(admin)/_authenticated/_qualified/organizations/$organizationId/audit/route.ts";

export function OrganizationsOrganizationidAuditPage() {
  const { organizationId } = Route.useParams();
  return (
    <DataErrorBoundary>
      <AdminOrganizationDetail organizationId={organizationId} section="audit" />
    </DataErrorBoundary>
  );
}
