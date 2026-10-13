import { t as translate } from "#client/shared/i18n";
import type { AccessMember, AccessRole } from "#client/entities/access";
import { ActionForm, useAccessMutations } from "#client/features/manage-access";
import { useService } from "#client/shared/api/client-context";
import { scopeRoleChoices } from "#client/widgets/access-console/model/role-choices";

export function ScopeMemberRoleForm(props: {
  member: AccessMember;
  scope: string;
  roles: readonly AccessRole[] | undefined;
}) {
  const service = useService(["business", "operator"]);
  const mutations = useAccessMutations();
  return (
    <ActionForm
      label={translate("権限を変更")}
      fields={[
        {
          name: "roleId",
          label: translate("ロール"),
          initial: props.member.roleId,
          options: scopeRoleChoices(props.roles, props.member.category).invitationOptions,
        },
      ]}
      onSubmit={async (v) => {
        await mutations.assignRole.mutateAsync({
          service,
          scope: props.scope,
          membershipId: props.member.id,
          roleId: v.roleId ?? "",
        });
      }}
    />
  );
}
