import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "#client/shared/api/trpc";

export function DeniedAction() {
  const trpc = useTRPC();
  const action = useMutation(trpc.access.invite.mutationOptions());
  return (
    <>
      <button
        type="button"
        onClick={() =>
          action.mutate({
            service: "business",
            scope: "tenant-a",
            email: "invitee@example.com",
            roleId: "business-member",
            actorKind: "business",
          })
        }
      >
        権限がない操作
      </button>
      {action.error && <p>操作を拒否しました</p>}
    </>
  );
}
