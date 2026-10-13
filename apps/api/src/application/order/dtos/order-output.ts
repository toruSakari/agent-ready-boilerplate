import { z } from "zod";
import { orderSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const orderListItemDtoSchema = orderSnapshotSchema.and(
  z.object({
    paymentStatus: z.union([z.string(), z.null()]).optional(),
    statusLabel: z.string().optional(),
  }),
);
export const OrderListItemDto = orderListItemDtoSchema.brand<"OrderListItemDto">().readonly();

export type OrderListItemDto = z.infer<typeof OrderListItemDto>;
