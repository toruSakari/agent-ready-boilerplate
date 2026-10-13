import type { z } from "zod";
import { storePageDtoSchema } from "#api/application/store/dtos/store-page-dto.ts";
import { StoreProductDto } from "#api/application/store/dtos/store-product-dto.ts";

export const storeListOutputDtoSchema = storePageDtoSchema(StoreProductDto);

export const StoreListOutputDto = storeListOutputDtoSchema.brand<"StoreListOutputDto">().readonly();

export type StoreListOutputDto = z.infer<typeof StoreListOutputDto>;
