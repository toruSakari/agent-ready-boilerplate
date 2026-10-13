import { t as translate } from "@dev-template/client/i18n";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { Card } from "@dev-template/ui/card";
import { AdminOrganizationRow } from "#admin/widgets/admin-console/ui/admin-organization-row.tsx";

export function AdminOrganizationsTable(props: { organizations: AccessOrganization[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[1fr_100px_100px_100px] gap-4 border-b bg-muted/40 px-6 py-3 text-xs font-semibold text-muted-foreground sm:grid">
        <span>{translate("企業名")}</span>
        <span>{translate("状態")}</span>
        <span>{translate("所属人数")}</span>
        <span>{translate("操作")}</span>
      </div>
      {props.organizations.map((o) => (
        <AdminOrganizationRow key={o.id} organization={o} />
      ))}
      {props.organizations.length === 0 && (
        <p className="p-10 text-center text-muted-foreground">
          {translate("該当する企業はありません。")}
        </p>
      )}
    </Card>
  );
}
