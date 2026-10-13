import { t as translate } from "@dev-template/client/i18n";
import type { AccessOrganization, AccessUser } from "#admin/entities/directory/index.ts";
import { Card } from "@dev-template/ui/card";

export function AdminOverviewMetrics(props: {
  organizations: AccessOrganization[] | null;
  users: AccessUser[] | null;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {props.organizations !== null && (
        <Card className="border-t-4 border-t-primary p-6">
          <p className="text-sm text-muted-foreground">{translate("登録企業")}</p>
          <p className="my-3 text-4xl font-bold">{props.organizations.length}</p>
          <p className="text-sm text-muted-foreground">
            {translate("利用中 {{active}}社・利用停止 {{inactive}}社", {
              active: props.organizations.filter((o) => o.active).length,
              inactive: props.organizations.filter((o) => !o.active).length,
            })}
          </p>
        </Card>
      )}
      {props.users !== null && (
        <Card className="border-t-4 border-t-secondary p-6">
          <p className="text-sm text-muted-foreground">{translate("サービス登録")}</p>
          <p className="my-3 text-4xl font-bold">{props.users.length}</p>
          <p className="text-sm text-muted-foreground">
            {translate("同じ利用者のサービス別登録は個別に数えます。")}
          </p>
        </Card>
      )}
    </section>
  );
}
