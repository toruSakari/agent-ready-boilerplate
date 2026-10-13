import { ORDER_STATUS_CODES } from "#api/domain/order/policies/order-status.ts";
import { z } from "zod";

export const LIST_FILTER_LIMITS = Object.freeze({ searchLength: 100, planCodeLength: 200 });
export const listFiltersSchema = z.object({
  search: z.string().trim().max(LIST_FILTER_LIMITS.searchLength).optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
});
export const orderFiltersSchema = listFiltersSchema
  .extend({
    status: z.enum(ORDER_STATUS_CODES).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to);
export const inventoryFiltersSchema = listFiltersSchema.extend({
  stock: z.enum(["in-stock", "out-of-stock"]).optional(),
});
export const storeFiltersSchema = inventoryFiltersSchema
  .extend({
    minPrice: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    maxPrice: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
  );
export const organizationFiltersSchema = z.object({
  search: z.string().trim().max(LIST_FILTER_LIMITS.searchLength).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  planCode: z.string().min(1).max(LIST_FILTER_LIMITS.planCodeLength).optional(),
});

export type ListFilters = z.infer<typeof listFiltersSchema>;

export type OrderFilters = z.infer<typeof orderFiltersSchema>;

export type InventoryFilters = z.infer<typeof inventoryFiltersSchema>;

export type StoreFilters = z.infer<typeof storeFiltersSchema>;

export type OrganizationFilters = z.infer<typeof organizationFiltersSchema>;
