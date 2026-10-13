import { useState } from "react";
import { useAccessMutations } from "#client/features/manage-access";
import { ProtectedPage } from "#client/test/access-qualification/protected-page";

export function InviteWorkflow() {
  const mutations = useAccessMutations();
  const [inviteLink, setInviteLink] = useState("");
  return (
    <>
      <ProtectedPage />
      <button
        type="button"
        onClick={async () => {
          const result = await mutations.invite.mutateAsync({
            service: "business",
            scope: "tenant-a",
            email: "invitee@example.com",
            roleId: "business-member",
            actorKind: "business",
          });
          setInviteLink(`/invitations/accept#${result.token}`);
        }}
      >
        招待を発行する
      </button>
      {inviteLink && <input aria-label="発行した招待リンク" readOnly value={inviteLink} />}
    </>
  );
}
