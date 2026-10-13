import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const customerPlanChangeInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ planCode: z.union([z.string(), z.null()]) }),
});

export const CustomerPlanChangeInputDto = customerPlanChangeInputDtoSchema
  .brand<"CustomerPlanChangeInputDto">()
  .readonly();

export type CustomerPlanChangeInputDto = z.infer<typeof CustomerPlanChangeInputDto>;
