import { z } from "zod";

export const storeGetInputDtoSchema = z.object({ tenantId: z.string(), sku: z.string() });

export const StoreGetInputDto = storeGetInputDtoSchema.brand<"StoreGetInputDto">().readonly();

export type StoreGetInputDto = z.infer<typeof StoreGetInputDto>;
