import type { z } from "zod";
import { orderSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const storeCheckoutOutputDtoSchema = orderSnapshotSchema;

export const StoreCheckoutOutputDto = storeCheckoutOutputDtoSchema
  .brand<"StoreCheckoutOutputDto">()
  .readonly();

export type StoreCheckoutOutputDto = z.infer<typeof StoreCheckoutOutputDto>;
