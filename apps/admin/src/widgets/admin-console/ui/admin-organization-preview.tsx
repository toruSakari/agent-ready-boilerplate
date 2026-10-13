import { t as translate } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { Card } from "@dev-template/ui/card";
import { Button } from "@dev-template/ui/button";
import { Badge } from "@dev-template/ui/badge";

const DASHBOARD_ORGANIZATION_PREVIEW_LIMIT = 5;

export function AdminOrganizationPreview(props: { organizations: AccessOrganization[] }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{translate("企業の利用状況")}</h2>
        <Button asChild variant="ghost">
          <Link to="/organizations">{translate("すべて表示")}</Link>
        </Button>
      </div>
      <Card className="divide-y">
        {props.organizations.slice(0, DASHBOARD_ORGANIZATION_PREVIEW_LIMIT).map((o) => (
          <Link
            key={o.id}
            to="/organizations/$organizationId"
            params={{ organizationId: o.id }}
            className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-muted/50"
          >
            <span className="min-w-0 break-words font-medium">{o.name}</span>
            <Badge
              variant={o.active ? "default" : "secondary"}
              className="shrink-0 whitespace-nowrap"
            >
              {o.active ? translate("利用中") : translate("利用停止")}
            </Badge>
          </Link>
        ))}
        {props.organizations.length === 0 && (
          <p className="p-8 text-muted-foreground">{translate("登録された企業はありません。")}</p>
        )}
      </Card>
    </section>
  );
}
