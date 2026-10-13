import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";
import { PRODUCT_PAGE_SIZE } from "#web/entities/store-product/model/product.ts";

export function useStoreProducts(
  search: string,
  cursor?: { createdAt: string; id: string },
  filters: Omit<
    import("@dev-template/api-types").RouterInputs["store"]["list"],
    "limit" | "cursor" | "search"
  > = {},
) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(
    trpc.store.list.queryOptions({
      ...filters,
      search: search || undefined,
      limit: PRODUCT_PAGE_SIZE,
      cursor,
    }),
  );
  if (query.error) {
    throw query.error;
  }

  return query;
}

export function useStoreProduct(tenantId: string, sku: string) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(trpc.store.get.queryOptions({ tenantId, sku }));
  if (query.error) {
    throw query.error;
  }

  return query;
}

export function useProductImage(tenantId: string, sku: string, imageId?: string) {
  const trpc = useTRPC();
  // 画像は購入情報を隠さず代替表示する。画像なしの場合に不要な通信をしない。
  return useQuery(
    trpc.store.getImage.queryOptions(
      { tenantId, sku, imageId },
      { enabled: !!imageId, throwOnError: false, retry: false },
    ),
  );
}
