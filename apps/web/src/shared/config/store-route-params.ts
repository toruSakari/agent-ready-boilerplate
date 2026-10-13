import { z } from "zod";
import { CATALOG_INPUT_LIMITS, LIST_SEARCH_LIMITS } from "@dev-template/client/config";
import { organizationIdPathSchema } from "@dev-template/client/route-params";

export const STORE_PATH_LIMITS = Object.freeze({
  searchMaxLength: LIST_SEARCH_LIMITS.textLength,
  skuMaxLength: CATALOG_INPUT_LIMITS.skuMaxLength,
});
export const productPathParams = {
  parse: (params: { organizationId: string; sku: string }) =>
    z
      .object({
        organizationId: organizationIdPathSchema,
        sku: organizationIdPathSchema.max(STORE_PATH_LIMITS.skuMaxLength),
      })
      .parse(params),
};
export const orderPathParams = {
  parse: (params: { orderId: string }) => z.object({ orderId: z.uuid() }).parse(params),
};
