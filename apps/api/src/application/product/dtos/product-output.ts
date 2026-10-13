import { z } from "zod";

export const productListItemDtoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  sku: z.string(),
  name: z.string(),
  unitPrice: z.number(),
  imageKey: z.union([z.null(), z.string()]),
  images: z.array(z.object({ id: z.string(), key: z.string(), createdAt: z.string() })),
  createdAt: z.string(),
});
export const ProductListItemDto = productListItemDtoSchema.brand<"ProductListItemDto">().readonly();

export type ProductListItemDto = z.infer<typeof ProductListItemDto>;
