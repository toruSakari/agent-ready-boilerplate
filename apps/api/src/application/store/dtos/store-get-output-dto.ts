import type { z } from "zod";
import { storeProductDtoSchema } from "#api/application/store/dtos/store-product-dto.ts";

export const storeGetOutputDtoSchema = storeProductDtoSchema;

export const StoreGetOutputDto = storeGetOutputDtoSchema.brand<"StoreGetOutputDto">().readonly();

export type StoreGetOutputDto = z.infer<typeof StoreGetOutputDto>;
