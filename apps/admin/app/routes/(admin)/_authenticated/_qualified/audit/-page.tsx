import { AdminAccess } from "#admin/widgets/admin-console/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function AuditPage() {
  return (
    <DataErrorBoundary>
      <AdminAccess section="audit" />
    </DataErrorBoundary>
  );
}
