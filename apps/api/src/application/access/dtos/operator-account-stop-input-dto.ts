import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const operatorAccountStopInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const OperatorAccountStopInputDto = operatorAccountStopInputDtoSchema
  .brand<"OperatorAccountStopInputDto">()
  .readonly();

export type OperatorAccountStopInputDto = z.infer<typeof OperatorAccountStopInputDto>;
