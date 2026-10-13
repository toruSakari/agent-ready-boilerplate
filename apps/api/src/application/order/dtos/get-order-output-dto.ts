import type { z } from "zod";
import { orderListItemDtoSchema } from "#api/application/order/dtos/order-output.ts";

export const getOrderOutputDtoSchema = orderListItemDtoSchema;

export const GetOrderOutputDto = getOrderOutputDtoSchema.brand<"GetOrderOutputDto">().readonly();

export type GetOrderOutputDto = z.infer<typeof GetOrderOutputDto>;
