import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useSuspenseOptionalQuery, perQueryAccessOptions } from "@dev-template/client/api";

export function usePlans(category: "business") {
  const t = useTRPC();
  return useSuspenseOptionalQuery(t.access.plans.queryOptions({ category }, perQueryAccessOptions));
}

export function useAssignPlan() {
  const t = useTRPC();
  const client = useQueryClient();
  return useMutation(
    t.access.assignPlan.mutationOptions({
      onSuccess: async () => {
        await client.cancelQueries(t.access.pathFilter());
        await client.invalidateQueries(t.access.pathFilter());
      },
    }),
  );
}

export function useOrganizationPlan(id: string) {
  const t = useTRPC();
  return useSuspenseOptionalQuery(
    t.access.organizationPlan.queryOptions({ id }, perQueryAccessOptions),
  );
}
