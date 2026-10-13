import { z } from "zod";

export const cleanupProductImagesOutputDtoSchema = z.object({
  deleted: z.number(),
  failed: z.number(),
});

export const CleanupProductImagesOutputDto = cleanupProductImagesOutputDtoSchema
  .brand<"CleanupProductImagesOutputDto">()
  .readonly();

export type CleanupProductImagesOutputDto = z.infer<typeof CleanupProductImagesOutputDto>;
