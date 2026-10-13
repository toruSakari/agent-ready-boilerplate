import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessDeleteUserInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  userId: z.string(),
});

export const AccessDeleteUserInputDto = accessDeleteUserInputDtoSchema
  .brand<"AccessDeleteUserInputDto">()
  .readonly();

export type AccessDeleteUserInputDto = z.infer<typeof AccessDeleteUserInputDto>;
