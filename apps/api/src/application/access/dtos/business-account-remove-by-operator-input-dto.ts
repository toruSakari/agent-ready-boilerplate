import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const businessAccountRemoveByOperatorInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  accountId: z.string(),
});

export const BusinessAccountRemoveByOperatorInputDto = businessAccountRemoveByOperatorInputDtoSchema
  .brand<"BusinessAccountRemoveByOperatorInputDto">()
  .readonly();

export type BusinessAccountRemoveByOperatorInputDto = z.infer<
  typeof BusinessAccountRemoveByOperatorInputDto
>;
