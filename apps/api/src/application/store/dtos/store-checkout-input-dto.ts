import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";
import { orderLineSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const storeCheckoutInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  tenantId: z.string(),
  lines: z.array(orderLineSnapshotSchema),
});

export const StoreCheckoutInputDto = storeCheckoutInputDtoSchema
  .brand<"StoreCheckoutInputDto">()
  .readonly();

export type StoreCheckoutInputDto = z.infer<typeof StoreCheckoutInputDto>;
