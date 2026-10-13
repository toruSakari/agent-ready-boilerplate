import type { z } from "zod";
import { orderSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const storeCancelOrderOutputDtoSchema = orderSnapshotSchema;

export const StoreCancelOrderOutputDto = storeCancelOrderOutputDtoSchema
  .brand<"StoreCancelOrderOutputDto">()
  .readonly();

export type StoreCancelOrderOutputDto = z.infer<typeof StoreCancelOrderOutputDto>;
