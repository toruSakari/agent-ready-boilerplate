import { z } from "zod";

export const storeProductDtoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  organizationName: z.string(),
  sku: z.string(),
  name: z.string(),
  unitPrice: z.number(),
  availableQuantity: z.number(),
  createdAt: z.string(),
  images: z.array(z.object({ id: z.string() })),
});

export const StoreProductDto = storeProductDtoSchema.brand<"StoreProductDto">().readonly();

export type StoreProductDto = z.infer<typeof StoreProductDto>;
