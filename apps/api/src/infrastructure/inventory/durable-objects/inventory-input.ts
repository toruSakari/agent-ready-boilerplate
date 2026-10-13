import { z } from "zod";
import { STOCK_QUANTITY_LIMITS } from "#api/domain/inventory/value-objects/stock-quantity.ts";

export const reservationSchema = z.object({
  orderId: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  quantity: z.number().int().positive(),
});

export type Reservation = Readonly<{
  orderId: string;
  sku: string;
  quantity: number;
}>;

export const stockChangeSchema = z.object({
  sku: z.string().trim().min(1),
  quantity: z.number().int().min(STOCK_QUANTITY_LIMITS.min).max(STOCK_QUANTITY_LIMITS.max),
  expectedStock: z
    .number()
    .int()
    .min(STOCK_QUANTITY_LIMITS.min)
    .max(STOCK_QUANTITY_LIMITS.max)
    .optional(),
});
