import type { z } from "zod";
import { createOrderInputSchema } from "#api/application/order/dtos/create-order-input.ts";

export const createOrderInputDtoSchema = createOrderInputSchema;

export const CreateOrderInputDto = createOrderInputDtoSchema
  .brand<"CreateOrderInputDto">()
  .readonly();

export type CreateOrderInputDto = z.infer<typeof CreateOrderInputDto>;
