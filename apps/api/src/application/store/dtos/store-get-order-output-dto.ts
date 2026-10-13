import type { z } from "zod";
import { orderListItemDtoSchema } from "#api/application/order/dtos/order-output.ts";

export const storeGetOrderOutputDtoSchema = orderListItemDtoSchema;

export const StoreGetOrderOutputDto = storeGetOrderOutputDtoSchema
  .brand<"StoreGetOrderOutputDto">()
  .readonly();

export type StoreGetOrderOutputDto = z.infer<typeof StoreGetOrderOutputDto>;
