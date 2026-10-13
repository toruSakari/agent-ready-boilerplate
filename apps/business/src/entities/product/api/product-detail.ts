import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC, perQueryAccessOptions } from "@dev-template/client/api";

export function useProductDetail(id: string) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(
    trpc.product.get.queryOptions({ service: "business", id }, perQueryAccessOptions),
  );
  if (query.error) {
    throw query.error;
  }

  return query.data;
}
