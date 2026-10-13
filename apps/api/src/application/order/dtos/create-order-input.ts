import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";
import { orderLineSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const createOrderInputSchema = z.object({
  identity: authorizedActorSchema,
  lines: z.array(orderLineSnapshotSchema),
  draft: z.boolean().optional(),
});
export const CreateOrderInput = createOrderInputSchema.brand<"CreateOrderInput">().readonly();

export type CreateOrderInput = z.infer<typeof CreateOrderInput>;
