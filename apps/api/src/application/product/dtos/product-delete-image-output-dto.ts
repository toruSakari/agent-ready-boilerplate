import { z } from "zod";

export const productDeleteImageOutputDtoSchema = z.object({ ok: z.literal(true) });

export const ProductDeleteImageOutputDto = productDeleteImageOutputDtoSchema
  .brand<"ProductDeleteImageOutputDto">()
  .readonly();

export type ProductDeleteImageOutputDto = z.infer<typeof ProductDeleteImageOutputDto>;
