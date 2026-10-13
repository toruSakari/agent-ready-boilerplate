import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#client/shared/api/trpc";

export function RefreshSession() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  return (
    <button
      type="button"
      onClick={() => void queryClient.invalidateQueries(trpc.access.pathFilter())}
    >
      所属を再確認
    </button>
  );
}
