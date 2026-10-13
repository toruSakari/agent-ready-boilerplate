import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";

export function useCustomerPlans() {
  const trpc = useTRPC();
  const query = useSuspenseQuery(trpc.access.customerPlans.queryOptions());
  if (query.error) {
    throw query.error;
  }

  return query.data;
}

export function useChangeCustomerPlan() {
  const trpc = useTRPC();
  const client = useQueryClient();
  return useMutation(
    trpc.access.changeCustomerPlan.mutationOptions({
      onSuccess: async () => {
        await client.cancelQueries(trpc.access.pathFilter());
        await client.invalidateQueries(trpc.access.pathFilter());
      },
    }),
  );
}
