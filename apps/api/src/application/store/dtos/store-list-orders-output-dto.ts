import type { z } from "zod";
import { storePageDtoSchema } from "#api/application/store/dtos/store-page-dto.ts";
import { OrderListItemDto } from "#api/application/order/dtos/order-output.ts";

export const storeListOrdersOutputDtoSchema = storePageDtoSchema(OrderListItemDto);

export const StoreListOrdersOutputDto = storeListOrdersOutputDtoSchema
  .brand<"StoreListOrdersOutputDto">()
  .readonly();

export type StoreListOrdersOutputDto = z.infer<typeof StoreListOrdersOutputDto>;
