import { z } from "zod";

export const storeGetImageInputDtoSchema = z.object({
  tenantId: z.string(),
  sku: z.string(),
  imageId: z.union([z.string(), z.undefined()]).optional(),
});

export const StoreGetImageInputDto = storeGetImageInputDtoSchema
  .brand<"StoreGetImageInputDto">()
  .readonly();

export type StoreGetImageInputDto = z.infer<typeof StoreGetImageInputDto>;
