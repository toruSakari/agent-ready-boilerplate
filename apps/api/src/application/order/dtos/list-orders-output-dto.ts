import { z } from "zod";
import { OrderListItemDto } from "#api/application/order/dtos/order-output.ts";

export const listOrdersOutputDtoSchema = z.object({ items: z.array(OrderListItemDto) });

export const ListOrdersOutputDto = listOrdersOutputDtoSchema
  .brand<"ListOrdersOutputDto">()
  .readonly();

export type ListOrdersOutputDto = z.infer<typeof ListOrdersOutputDto>;
