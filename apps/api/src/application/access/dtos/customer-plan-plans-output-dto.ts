import { z } from "zod";

export const customerPlanPlansOutputDtoSchema = z.object({
  currentCode: z.union([z.string(), z.null()]),
  plans: z.array(z.object({ code: z.string(), name: z.string() })),
});

export const CustomerPlanPlansOutputDto = customerPlanPlansOutputDtoSchema
  .brand<"CustomerPlanPlansOutputDto">()
  .readonly();

export type CustomerPlanPlansOutputDto = z.infer<typeof CustomerPlanPlansOutputDto>;
