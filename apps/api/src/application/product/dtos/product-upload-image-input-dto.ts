import type { z } from "zod";
import { productUploadImageInputDtoSchema } from "#api/application/product/schemas/product-image-input-schemas.ts";

export const ProductUploadImageInputDto = productUploadImageInputDtoSchema
  .brand<"ProductUploadImageInputDto">()
  .readonly();

export type ProductUploadImageInputDto = z.infer<typeof ProductUploadImageInputDto>;
