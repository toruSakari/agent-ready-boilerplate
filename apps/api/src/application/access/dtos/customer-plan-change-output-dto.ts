import { z } from "zod";

export const customerPlanChangeOutputDtoSchema = z.object({ ok: z.literal(true) });

export const CustomerPlanChangeOutputDto = customerPlanChangeOutputDtoSchema
  .brand<"CustomerPlanChangeOutputDto">()
  .readonly();

export type CustomerPlanChangeOutputDto = z.infer<typeof CustomerPlanChangeOutputDto>;
