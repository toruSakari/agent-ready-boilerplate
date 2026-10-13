import { t as translate } from "#client/shared/i18n";
import { SERVICE_CATEGORY_LABELS } from "#client/entities/access";
import type { AccessMember, AccessRole } from "#client/entities/access";
import { AccessAction, useAccessMutations } from "#client/features/manage-access";
import { useService } from "#client/shared/api/client-context";
import { Card } from "@dev-template/ui/card";
import { Badge } from "@dev-template/ui/badge";
import { ScopeMemberRoleForm } from "#client/widgets/access-console/ui/scope-member-role-form";

export function ScopeMemberCard(props: {
  member: AccessMember;
  scope: string;
  canReadEmail: boolean;
  canAssignRole: boolean;
  canRemove: boolean;
  visibleRoles: readonly AccessRole[] | undefined;
}) {
  const service = useService(["business", "operator"]);
  const mutations = useAccessMutations();
  return (
    <Card className="grid gap-3 p-5">
      <h3 className="font-semibold">{props.member.name}</h3>
      {props.canReadEmail && props.member.email && <p>{props.member.email}</p>}
      <Badge>{props.member.roleName}</Badge>
      <Badge>
        {translate("{{service}}サービス", {
          service: SERVICE_CATEGORY_LABELS[props.member.category],
        })}
      </Badge>
      {props.canAssignRole && (
        <ScopeMemberRoleForm member={props.member} scope={props.scope} roles={props.visibleRoles} />
      )}
      {props.canRemove && (
        <AccessAction
          label={translate("企業から削除")}
          confirmation={translate("{{name}}の所属を解除しますか？", { name: props.member.name })}
          onAction={() =>
            mutations.removeMember.mutateAsync({
              service,
              scope: props.scope,
              membershipId: props.member.id,
            })
          }
        />
      )}
    </Card>
  );
}
