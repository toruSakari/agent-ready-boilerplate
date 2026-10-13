import { AdminAccess } from "#admin/widgets/admin-console/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function RolesPage() {
  return (
    <DataErrorBoundary>
      <AdminAccess section="roles" />
    </DataErrorBoundary>
  );
}
