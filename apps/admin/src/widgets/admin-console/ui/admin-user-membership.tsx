import { t as translate } from "@dev-template/client/i18n";
import { usePermissions } from "@dev-template/client/entities/access";
import { AccessAction, useAccessMutations } from "@dev-template/client/manage-access";
import type { AccessUser } from "#admin/entities/directory/index.ts";

export function AdminUserMembership(props: {
  membership: AccessUser["memberships"][number];
  userName: string;
}) {
  const { can } = usePermissions("platform");
  const mutations = useAccessMutations();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span>
        {props.membership.organizationName}：{props.membership.roleName}
      </span>
      {can("member.remove") && (
        <AccessAction
          label={translate("所属を解除")}
          confirmation={translate("{{name}}の{{organization}}への所属を解除しますか？", {
            name: props.userName,
            organization: props.membership.organizationName,
          })}
          onAction={() =>
            mutations.removeMember.mutateAsync({
              service: "operator",
              scope: props.membership.scope,
              membershipId: props.membership.id,
            })
          }
        />
      )}
    </div>
  );
}
