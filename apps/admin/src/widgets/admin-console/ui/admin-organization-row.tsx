import { Link } from "@tanstack/react-router";
import { t as translate } from "@dev-template/client/i18n";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { Badge } from "@dev-template/ui/badge";
import { Button } from "@dev-template/ui/button";

export function AdminOrganizationRow(props: { organization: AccessOrganization }) {
  return (
    <div className="grid items-center gap-3 border-b px-6 py-5 last:border-0 sm:grid-cols-[1fr_100px_100px_100px]">
      <div>
        <p className="min-w-0 break-words font-semibold">{props.organization.name}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">{props.organization.id}</p>
      </div>
      <Badge
        variant={props.organization.active ? "default" : "secondary"}
        className="w-fit shrink-0 whitespace-nowrap"
      >
        {props.organization.active ? translate("利用中") : translate("利用停止")}
      </Badge>
      <span className="text-sm text-muted-foreground">
        {translate("{{count}}名", { count: props.organization.memberCount })}
      </span>
      <Button variant="outline" asChild>
        <Link
          to="/organizations/$organizationId"
          params={{ organizationId: props.organization.id }}
          aria-label={translate("{{name}}を管理", { name: props.organization.name })}
        >
          {translate("企業を管理")}
        </Link>
      </Button>
    </div>
  );
}
