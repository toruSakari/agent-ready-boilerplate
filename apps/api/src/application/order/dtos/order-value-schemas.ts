import { z } from "zod";
import { ORDER_EVENT_NAMES } from "#api/domain/order/entities/order.ts";
import { orderStatusSchema } from "#api/application/shared/dto-schemas.ts";

export const orderLineSnapshotSchema = z
  .object({ sku: z.string(), name: z.string(), quantity: z.number(), unitPrice: z.number() })
  .readonly();
export const orderSnapshotSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  customerId: z.string(),
  status: orderStatusSchema,
  lines: z.array(orderLineSnapshotSchema),
  total: z.number(),
  createdAt: z.string(),
  version: z.number(),
  reservationId: z.string().nullable(),
});
export const orderEventSchema = z
  .object({
    id: z.string(),
    name: z.enum(ORDER_EVENT_NAMES),
    aggregateId: z.string(),
    occurredAt: z.string(),
    payload: orderSnapshotSchema.pick({
      tenantId: true,
      customerId: true,
      total: true,
      lines: true,
      reservationId: true,
    }),
  })
  .readonly();
