import { z } from "zod";
import { LIST_SEARCH_LIMITS } from "#client/shared/config/input-limits.ts";

export const listSearchSchema = z.object({
  q: z.string().trim().max(LIST_SEARCH_LIMITS.textLength).optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
});
export const orderListSearchSchema = listSearchSchema
  .extend({
    status: z.enum(["draft", "confirmed", "shipped", "completed", "cancelled"]).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to);
export const inventoryListSearchSchema = listSearchSchema.extend({
  stock: z.enum(["in-stock", "out-of-stock"]).optional(),
});
const price = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
  .optional();
export const storeListSearchSchema = inventoryListSearchSchema
  .extend({
    minPrice: price,
    maxPrice: price,
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice);
export const organizationListSearchSchema = z.object({
  q: z.string().trim().max(LIST_SEARCH_LIMITS.textLength).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  planCode: z.string().min(1).max(LIST_SEARCH_LIMITS.planCodeLength).optional(),
});

export type ListSearch = {
  q?: string;
  sort?: "newest" | "oldest";
  status?: string;
  stock?: string;
  from?: string;
  to?: string;
  planCode?: string;
  minPrice?: number;
  maxPrice?: number;
};

export const orderFilterOptions = [
  { value: "", label: "すべて" },
  { value: "draft", label: "下書き" },
  { value: "confirmed", label: "発送待ち" },
  { value: "shipped", label: "発送済み" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "キャンセル" },
];
export const stockFilterOptions = [
  { value: "", label: "すべて" },
  { value: "in-stock", label: "在庫あり" },
  { value: "out-of-stock", label: "在庫切れ" },
];
