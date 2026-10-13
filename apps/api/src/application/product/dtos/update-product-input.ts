import { z } from "zod";

export const updateProductInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  unitPrice: z.number(),
  expectedName: z.string(),
  expectedUnitPrice: z.number(),
});
export const UpdateProductInput = updateProductInputSchema.brand<"UpdateProductInput">().readonly();

export type UpdateProductInput = z.infer<typeof UpdateProductInput>;
