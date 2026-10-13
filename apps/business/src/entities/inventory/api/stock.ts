import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC, perQueryAccessOptions } from "@dev-template/client/api";

export function useStock(id: string) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(trpc.inventory.get.queryOptions({ id }, perQueryAccessOptions));
  if (query.error) {
    throw query.error;
  }

  return query.data;
}
