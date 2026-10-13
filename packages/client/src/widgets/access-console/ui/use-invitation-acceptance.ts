import { useState } from "react";
import { useAccessMutations, useInvitation } from "#client/features/manage-access";
import { useAuthenticationStatus } from "#client/shared/api/authentication-context";
import { useService } from "#client/shared/api/client-context";

export function useInvitationAcceptance() {
  const service = useService();
  const { invitation, error, clear, revision } = useInvitation();
  const authentication = useAuthenticationStatus();
  const mutations = useAccessMutations();
  const [accepted, setAccepted] = useState("");
  const [acceptedRevision, setAcceptedRevision] = useState(-1);
  const showAccepted = accepted && revision === acceptedRevision;
  async function accept(values: Record<string, string | undefined>) {
    if (!invitation) {
      return;
    }

    const token = invitation.token;
    const result = await mutations.acceptInvitation.mutateAsync({
      service,
      token,
      name: values.name ?? "",
    });
    // 遅れた応答でも、送信した招待が現在の世代と一致するときだけ完了へ進む。
    if (clear(token, revision)) {
      setAcceptedRevision(revision);
      setAccepted(result.scope);
    }
  }
  function close() {
    if (!invitation) {
      return;
    }

    clear(invitation.token, revision);
    setAccepted("");
    setAcceptedRevision(-1);
  }
  return { invitation, error, revision, authentication, accepted, showAccepted, accept, close };
}
