import { z } from "zod";

export const operatorAccountStopOutputDtoSchema = z.object({ category: z.literal("operator") });

export const OperatorAccountStopOutputDto = operatorAccountStopOutputDtoSchema
  .brand<"OperatorAccountStopOutputDto">()
  .readonly();

export type OperatorAccountStopOutputDto = z.infer<typeof OperatorAccountStopOutputDto>;
