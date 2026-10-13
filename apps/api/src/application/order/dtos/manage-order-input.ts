import { z } from "zod";
import { authorizedActorSchema, orderStatusSchema } from "#api/application/shared/dto-schemas.ts";
import { orderLineSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const manageOrderInputSchema = z
  .object({ identity: authorizedActorSchema, id: z.string(), version: z.number() })
  .and(
    z.union([
      z.object({ lines: z.array(orderLineSnapshotSchema), status: z.never().optional() }),
      z.object({
        status: orderStatusSchema.exclude(["draft"]),
        lines: z.never().optional(),
      }),
    ]),
  );
export const ManageOrderInput = manageOrderInputSchema.brand<"ManageOrderInput">().readonly();

export type ManageOrderInput = z.infer<typeof ManageOrderInput>;
