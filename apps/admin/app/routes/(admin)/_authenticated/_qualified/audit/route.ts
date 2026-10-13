import { createFileRoute } from "@tanstack/react-router";
import { AuditPage } from "#app/routes/(admin)/_authenticated/_qualified/audit/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/_qualified/audit/")({
  component: AuditPage,
});
