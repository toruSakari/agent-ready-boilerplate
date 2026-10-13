import { useAccessMutations } from "#client/features/manage-access";

export function AcceptMembership() {
  const { acceptInvitation } = useAccessMutations();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          acceptInvitation.mutate({
            service: "business",
            token: "a".repeat(64),
            name: "招待された本人",
          })
        }
      >
        所属を取得
      </button>
      {acceptInvitation.isSuccess && <p>所属を取得しました</p>}
    </>
  );
}
