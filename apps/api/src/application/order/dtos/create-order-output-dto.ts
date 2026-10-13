import type { z } from "zod";
import { orderSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const createOrderOutputDtoSchema = orderSnapshotSchema;

export const CreateOrderOutputDto = createOrderOutputDtoSchema
  .brand<"CreateOrderOutputDto">()
  .readonly();

export type CreateOrderOutputDto = z.infer<typeof CreateOrderOutputDto>;
