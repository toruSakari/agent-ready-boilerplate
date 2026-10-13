import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { AdminConsole } from "#admin/widgets/admin-console/index.ts";

export function HomePage() {
  return (
    <DataErrorBoundary>
      <AdminConsole />
    </DataErrorBoundary>
  );
}
