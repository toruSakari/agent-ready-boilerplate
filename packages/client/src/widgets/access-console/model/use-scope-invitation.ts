import { useState } from "react";
import type { AccessRole, ServiceCategory } from "#client/entities/access";
import { useAccessMutations } from "#client/features/manage-access";
import { useService } from "#client/shared/api/client-context";
import { scopeRoleChoices } from "#client/widgets/access-console/model/role-choices";
import { PLATFORM_SCOPE } from "#client/widgets/access-console/ui/access-scope";
import { invitationLink } from "#client/widgets/access-console/model/invitation-origin";

export function useScopeInvitation(scope: string, roles: readonly AccessRole[] | undefined) {
  const service = useService(["business", "operator"]);
  const mutations = useAccessMutations();
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCategory, setInviteCategory] = useState<ServiceCategory>(
    scope === PLATFORM_SCOPE ? "operator" : "business",
  );
  const { invitationOptions } = scopeRoleChoices(roles, inviteCategory);
  function changeCategory(value: string) {
    if (value !== "business" && value !== "operator") {
      return;
    }

    if (service === "business" && value !== "business") {
      return;
    }

    setInviteCategory(value);
    setInviteLink("");
  }
  async function submit(values: Record<string, string>) {
    const result = await mutations.invite.mutateAsync({
      service,
      scope,
      email: values.email ?? "",
      actorKind: inviteCategory,
      roleId: values.roleId ?? "",
    });
    setInviteLink(invitationLink(result.actorKind, service, result.token));
  }
  return {
    service,
    inviteCategory,
    inviteLink,
    invitationOptions,
    mutations,
    changeCategory,
    submit,
  };
}
