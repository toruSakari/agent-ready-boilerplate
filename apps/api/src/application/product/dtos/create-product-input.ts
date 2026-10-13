import { z } from "zod";

export const DEFAULT_INITIAL_STOCK = 0;
export const createProductInputSchema = z.object({
  sku: z.string(),
  name: z.string(),
  unitPrice: z.number(),
  initialStock: z.number().optional(),
});
export const CreateProductInput = createProductInputSchema.brand<"CreateProductInput">().readonly();

export type CreateProductInput = z.infer<typeof CreateProductInput>;
