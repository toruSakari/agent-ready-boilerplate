import type { RouterOutputs } from "@dev-template/api-types";

export type StoreProduct = RouterOutputs["store"]["get"];

export function productAvailability(product: StoreProduct) {
  return product.availableQuantity > 0;
}

export const PRODUCT_PAGE_SIZE = 24;
