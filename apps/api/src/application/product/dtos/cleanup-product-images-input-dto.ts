import { z } from "zod";

export const cleanupProductImagesInputDtoSchema = z.record(z.string(), z.never());

export const CleanupProductImagesInputDto = cleanupProductImagesInputDtoSchema
  .brand<"CleanupProductImagesInputDto">()
  .readonly();

export type CleanupProductImagesInputDto = z.infer<typeof CleanupProductImagesInputDto>;
