import { t as translate } from "@dev-template/client/i18n";
import { SERVICE_CATEGORY_LABELS, usePermissions } from "@dev-template/client/entities/access";
import type { AccessUser } from "#admin/entities/directory/index.ts";
import { Card } from "@dev-template/ui/card";
import { Badge } from "@dev-template/ui/badge";
import { AdminUserMembership } from "#admin/widgets/admin-console/ui/admin-user-membership.tsx";
import { DeleteUserRegistration } from "#admin/features/manage-users/index.ts";

export function AdminUserCard(props: { user: AccessUser }) {
  const { can } = usePermissions("platform");
  return (
    <Card className="grid gap-3 p-5">
      <h3 className="font-semibold">{props.user.name}</h3>
      {can("user.personal.read") && props.user.email && <p>{props.user.email}</p>}
      <Badge>
        {translate("{{service}}サービス", {
          service: SERVICE_CATEGORY_LABELS[props.user.category],
        })}
      </Badge>
      {props.user.memberships.map((membership) => (
        <AdminUserMembership
          key={membership.id}
          membership={membership}
          userName={props.user.name}
        />
      ))}
      {can("user.delete") && <DeleteUserRegistration user={props.user} />}
    </Card>
  );
}
