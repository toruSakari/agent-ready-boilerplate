import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const customerPlanPlansInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const CustomerPlanPlansInputDto = customerPlanPlansInputDtoSchema
  .brand<"CustomerPlanPlansInputDto">()
  .readonly();

export type CustomerPlanPlansInputDto = z.infer<typeof CustomerPlanPlansInputDto>;
