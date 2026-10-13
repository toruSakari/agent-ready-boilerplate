import { AdminUsers } from "#admin/widgets/admin-console/index.ts";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function UsersPage() {
  return (
    <DataErrorBoundary>
      <AdminUsers />
    </DataErrorBoundary>
  );
}
