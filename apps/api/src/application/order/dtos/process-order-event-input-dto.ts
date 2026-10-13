import { z } from "zod";
import { orderEventSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const processOrderEventInputDtoSchema = z.object({ event: orderEventSchema });

export const ProcessOrderEventInputDto = processOrderEventInputDtoSchema
  .brand<"ProcessOrderEventInputDto">()
  .readonly();

export type ProcessOrderEventInputDto = z.infer<typeof ProcessOrderEventInputDto>;
