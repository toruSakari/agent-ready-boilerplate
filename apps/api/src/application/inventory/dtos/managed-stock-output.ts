import { z } from "zod";

export const managedStockDtoSchema = z.object({
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
});
export const ManagedStockDto = managedStockDtoSchema.brand<"ManagedStockDto">().readonly();

export type ManagedStockDto = z.infer<typeof ManagedStockDto>;
